const crypto = require("node:crypto");
const { redis } = require("./_comun");

function tokenValid(primit, asteptat) {
    if (!asteptat) return false;
    const a = Buffer.from(String(primit || ""));
    const b = Buffer.from(asteptat);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

async function stergeTot() {
    let cursor = "0";
    let sterse = 0;
    let runde = 0;

    do {
        const raspuns = await redis([["SCAN", cursor, "MATCH", "demo:*", "COUNT", "200"]]);
        const rezultat = raspuns?.[0]?.result || ["0", []];
        cursor = String(rezultat[0]);
        const chei = rezultat[1] || [];

        if (chei.length) {
            await redis([["DEL", ...chei]]);
            sterse += chei.length;
        }

        runde += 1;
    } while (cursor !== "0" && runde < 50);

    return sterse;
}

async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    const primit =
        req.query.token || (req.headers["x-token-vizite"] ?? "");

    if (!tokenValid(primit, process.env.TOKEN_VIZITE)) {
        res.status(401).json({ eroare: "token invalid" });
        return;
    }
    if (req.method === "POST") {
        try {
            const sterse = await stergeTot();
            res.status(200).json({ ok: true, chei_sterse: sterse });
        } catch (eroare) {
            console.error("reset:", eroare.message);
            res.status(500).json({ eroare: "nu am putut sterge contoarele" });
        }
        return;
    }

    try {
        const sluguri = (await redis([["SMEMBERS", "demo:sluguri"]]))?.[0]?.result || [];

        if (!sluguri.length) {
            res.status(200).json({ demo: {} });
            return;
        }

        const comenzi = [];
        for (const slug of sluguri) {
            comenzi.push(["GET", `demo:${slug}:deschideri`]);
            comenzi.push(["GET", `demo:${slug}:persoane`]);
            comenzi.push(["LRANGE", `demo:${slug}:evenimente`, "0", "-1"]);
        }

        const rezultate = await redis(comenzi);
        const demo = {};

        sluguri.forEach((slug, index) => {
            const deschideri = Number(rezultate?.[index * 3]?.result || 0);
            const persoane = Number(rezultate?.[index * 3 + 1]?.result || 0);
            const brute = rezultate?.[index * 3 + 2]?.result || [];
            const evenimente = [];

            for (const intrare of brute) {
                try {
                    const e = JSON.parse(intrare);
                    if (e && e.t) {
                        // Doar campurile cunoscute: evenimentele vechi mai aveau
                        // oras si IP, care nu mai pleaca nicaieri.
                        evenimente.push({
                            t: e.t,
                            d: e.d || "necunoscut",
                            browser: e.browser || "",
                            os: e.os || "",
                            sursa: e.sursa || "",
                            a: e.a || "",
                            durata: 0,
                        });
                    }
                } catch {
                    // O intrare stricata nu are voie sa arunce tot raspunsul.
                }
            }

            demo[slug] = { deschideri, persoane, evenimente };
        });

        // Timpul pe pagina: secundele adunate de durata.js pe amprenta zilnica a
        // fiecarei persoane. Amprenta in sine nu iese din server.
        const cereri = [];
        for (const [slug, info] of Object.entries(demo)) {
            for (const e of info.evenimente) {
                if (e.a) {
                    cereri.push({ e, cmd: ["HGET", `demo:${slug}:durata:${e.t.slice(0, 10)}`, e.a] });
                }
            }
        }
        for (let i = 0; i < cereri.length; i += 500) {
            const bucata = cereri.slice(i, i + 500);
            const raspuns = await redis(bucata.map((c) => c.cmd));
            bucata.forEach((c, j) => {
                c.e.durata = Number(raspuns?.[j]?.result || 0);
            });
        }
        // `v` = vizitatorul, ca platforma sa grupeze paginile vazute de aceeasi
        // persoana in aceeasi zi. E amprenta zilnica (hash ireversibil, alt
        // sir in fiecare zi), nu un identificator al omului.
        for (const info of Object.values(demo)) {
            for (const e of info.evenimente) {
                e.v = e.a;
                delete e.a;
            }
        }

        res.status(200).json({ demo });
    } catch (eroare) {
        console.error("vizite:", eroare.message);
        res.status(500).json({ eroare: "nu am putut citi contoarele" });
    }
}

module.exports = handler;

const crypto = require("node:crypto");

async function redis(comenzi) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token =
        process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        throw new Error("Upstash nu e configurat");
    }

    const raspuns = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(comenzi),
    });

    if (!raspuns.ok) {
        throw new Error(`Upstash: ${raspuns.status}`);
    }

    return raspuns.json();
}

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
                        evenimente.push({ t: e.t, d: e.d || "necunoscut" });
                    }
                } catch {
                    // O intrare stricata nu are voie sa arunce tot raspunsul.
                }
            }

            demo[slug] = { deschideri, persoane, evenimente };
        });

        res.status(200).json({ demo });
    } catch (eroare) {
        console.error("vizite:", eroare.message);
        res.status(500).json({ eroare: "nu am putut citi contoarele" });
    }
}

module.exports = handler;

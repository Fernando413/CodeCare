/**
 * Numara vizualizarile unui demo.
 *
 * Pagina de demo cere de aici o imagine de 1x1 la incarcare. O imagine, nu un
 * fetch: nu are nevoie de CORS, merge si cand demo-ul e deschis direct pe
 * codecare-demos.vercel.app, si nu blocheaza randarea paginii.
 *
 * Nu se salveaza IP-ul si nu se scrie nimic in browserul vizitatorului, deci nu
 * e nevoie de banner de consimtamant. Ca sa putem totusi spune „doua persoane",
 * nu „cinci incarcari", se calculeaza un hash care se schimba in fiecare zi:
 * acelasi om care revine maine apare ca vizitator nou. Asta e compromisul
 * pentru „fara cookie-uri".
 */

const crypto = require("node:crypto");

// GIF transparent de 1x1, cel mai mic raspuns posibil care e o imagine valida.
const PIXEL = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
);

// Cand trimiti linkul, WhatsApp cere singur pagina ca sa faca previzualizarea.
// Fara filtrul asta, fiecare demo ar porni cu o vizualizare falsa la o secunda
// dupa ce l-ai trimis, si ai da follow-up unui om care nu s-a uitat inca.
const BOTI = [
    "whatsapp",
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "slackbot",
    "telegrambot",
    "discordbot",
    "linkedinbot",
    "skypeuripreview",
    "vkshare",
    "embedly",
    "bot",
    "crawler",
    "spider",
    "preview",
    "curl",
    "wget",
    "python-requests",
    "httpx",
    "headlesschrome",
    "lighthouse",
];

const ZILE_PASTRARE_PERSOANE = 40 * 24 * 60 * 60; // secunde
const MAX_EVENIMENTE = 500;

function esteBot(userAgent) {
    const ua = (userAgent || "").toLowerCase();
    if (!ua) return true; // niciun user-agent = aproape sigur un script
    return BOTI.some((semnal) => ua.includes(semnal));
}

function esteMobil(userAgent) {
    return /android|iphone|ipad|ipod|windows phone|mobile/i.test(userAgent || "");
}

function ipVizitator(req) {
    const inaintat = req.headers["x-forwarded-for"];
    if (typeof inaintat === "string" && inaintat.length) {
        return inaintat.split(",")[0].trim();
    }
    return req.headers["x-real-ip"] || "necunoscut";
}

/** Comenzi Redis prin API-ul REST al Upstash. Fara dependinte, doar fetch. */
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

/**
 * Numara o vizita pentru un slug. Intoarce true daca vizitatorul e nou azi.
 *
 * `SADD` intoarce 1 doar pentru o amprenta noua, deci un eveniment se scrie o
 * singura data per persoana per zi: asa numaram oameni, nu reincarcari.
 */
async function numara(slug, azi, amprenta, userAgent) {
    const cheiePersoane = `demo:${slug}:persoane:${azi}`;

    const rezultat = await redis([
        ["SADD", "demo:sluguri", slug],
        ["INCR", `demo:${slug}:deschideri`],
        ["SADD", cheiePersoane, amprenta],
        ["EXPIRE", cheiePersoane, String(ZILE_PASTRARE_PERSOANE)],
    ]);

    if (rezultat?.[2]?.result !== 1) {
        return false;
    }

    const eveniment = JSON.stringify({
        t: new Date().toISOString(),
        d: esteMobil(userAgent) ? "mobil" : "desktop",
    });

    await redis([
        // Contor propriu de persoane, pe langa lista de evenimente: lista e
        // plafonata, deci pe termen lung nu mai poate servi drept numaratoare.
        ["INCR", `demo:${slug}:persoane`],
        ["LPUSH", `demo:${slug}:evenimente`, eveniment],
        ["LTRIM", `demo:${slug}:evenimente`, "0", String(MAX_EVENIMENTE - 1)],
    ]);

    return true;
}

function trimitePixel(res) {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Content-Length", PIXEL.length);
    res.status(200).send(PIXEL);
}

async function handler(req, res) {
    // Orice s-ar intampla mai jos, vizitatorul primeste imaginea: o eroare de
    // numarare nu are voie sa lase un patrat rupt in pagina clientului.
    const slug = String(req.query.slug || "").toLowerCase();

    if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
        trimitePixel(res);
        return;
    }

    const userAgent = req.headers["user-agent"] || "";
    if (esteBot(userAgent)) {
        trimitePixel(res);
        return;
    }

    try {
        const azi = new Date().toISOString().slice(0, 10);
        const amprenta = crypto
            .createHash("sha256")
            .update(
                `${ipVizitator(req)}|${userAgent}|${process.env.TRACKING_SALT || ""}|${azi}`
            )
            .digest("hex")
            .slice(0, 16);

        await numara(slug, azi, amprenta, userAgent);

        // Paginile site-ului se numara si la gramada, sub slug-ul `site`. Fara
        // asta, acelasi om care intra pe Acasa, Preturi si Proiecte ar aparea
        // ca trei persoane — pe pagina e corect, pe site nu.
        if (slug.startsWith("site-")) {
            await numara("site", azi, amprenta, userAgent);
        }
    } catch (eroare) {
        console.error("vizita:", eroare.message);
    }

    trimitePixel(res);
}

module.exports = handler;

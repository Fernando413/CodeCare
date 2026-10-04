/*
 * Bucatile comune ale contorului (vizita.js, durata.js, vizite.js).
 *
 * Vercel nu face functii din fisierele din api/ care incep cu „_", deci asta
 * nu are adresa proprie; e doar importat.
 */
const crypto = require("node:crypto");

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

// Cat traiesc cheile zilnice (persoane, timpi). Dupa atat se sterg singure.
const ZILE_PASTRARE = 40 * 24 * 60 * 60; // secunde

const SLUG_VALID = /^[a-z0-9-]{1,80}$/;

function esteBot(userAgent) {
    const ua = (userAgent || "").toLowerCase();
    if (!ua) return true; // niciun user-agent = aproape sigur un script
    return BOTI.some((semnal) => ua.includes(semnal));
}

/*
 * Cookie-ul pus de /api/exclude pe dispozitivele proprietarului. Cererile vin
 * de pe codecare.ro (site si demo-uri, prin rewrite), deci cookie-ul vine
 * odata cu ele si vizita lui nu se numara.
 */
function esteExclus(req) {
    return /(?:^|;\s*)cc_exclus=1(?:;|$)/.test(req.headers.cookie || "");
}

function ipVizitator(req) {
    const inaintat = req.headers["x-forwarded-for"];
    if (typeof inaintat === "string" && inaintat.length) {
        return inaintat.split(",")[0].trim();
    }
    return req.headers["x-real-ip"] || "necunoscut";
}

function ziua() {
    return new Date().toISOString().slice(0, 10);
}

/*
 * Amprenta zilnica a unui vizitator: hash din IP + browser + sare + zi, taiat la
 * 16 caractere. Nu se poate inversa si se schimba la miezul noptii. IP-ul in
 * sine nu se salveaza nicaieri — doar intra in calcul.
 */
function amprenta(req, azi) {
    return crypto
        .createHash("sha256")
        .update(`${ipVizitator(req)}|${req.headers["user-agent"] || ""}|${process.env.TRACKING_SALT || ""}|${azi}`)
        .digest("hex")
        .slice(0, 16);
}

/** Comenzi Redis prin API-ul REST al Upstash. Fara dependinte, doar fetch. */
async function redis(comenzi) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

module.exports = { ZILE_PASTRARE, SLUG_VALID, esteBot, esteExclus, ziua, amprenta, redis };

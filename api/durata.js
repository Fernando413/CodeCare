/*
 * Cat a stat cineva pe o pagina.
 *
 * Pagina numara doar timpul cat a fost in fata (fila vizibila) si il trimite
 * cu navigator.sendBeacon cand e ascunsa sau inchisa: `?slug=...&s=<secunde>`.
 * Aici secundele se aduna pe amprenta zilnica a vizitatorului — aceeasi pe
 * care vizita.js a pus-o in eveniment —, deci vizite.js poate spune pentru
 * fiecare persoana cat a stat in total pe pagina in ziua aceea.
 *
 * O singura trimitere e plafonata la 30 de minute: o fila uitata in fata nu
 * are voie sa raporteze ore.
 */
const { ZILE_PASTRARE, SLUG_VALID, esteBot, esteExclus, ziua, amprenta, redis } = require("./_comun");

const MAX_SECUNDE = 30 * 60;

async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    const slug = String(req.query.slug || "").toLowerCase();
    const secunde = Math.min(parseInt(req.query.s, 10) || 0, MAX_SECUNDE);

    if (!SLUG_VALID.test(slug) || secunde < 1 || esteBot(req.headers["user-agent"]) || esteExclus(req)) {
        res.status(204).end();
        return;
    }

    try {
        const azi = ziua();
        const cheie = `demo:${slug}:durata:${azi}`;
        await redis([
            ["HINCRBY", cheie, amprenta(req, azi), String(secunde)],
            ["EXPIRE", cheie, String(ZILE_PASTRARE)],
        ]);
    } catch (eroare) {
        console.error("durata:", eroare.message);
    }

    res.status(204).end();
}

module.exports = handler;

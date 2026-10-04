/*
 * Numara o vizita: pagina (sau demo-ul) cere un GIF de 1x1 de aici la incarcare.
 *
 * Pentru fiecare persoana noua pe zi se salveaza un eveniment cu: ora, tipul
 * de dispozitiv, browserul, sistemul, site-ul de pe care a venit si amprenta
 * zilnica (folosita ca sa-i lipim apoi timpul petrecut pe pagina, vezi
 * durata.js). Fara oras si fara IP: orasul dedus din IP iesea gresit (Alba
 * Iulia aparea Bucuresti), deci nu merita nici stocat, nici declarat.
 */
const { ZILE_PASTRARE, SLUG_VALID, esteBot, esteExclus, ziua, amprenta, redis } = require("./_comun");

const PIXEL = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
);

const MAX_EVENIMENTE = 500;

function esteMobil(userAgent) {
    return /android|iphone|ipad|ipod|windows phone|mobile/i.test(userAgent || "");
}

function browser(ua) {
    if (/edg\//i.test(ua)) return "Edge";
    if (/opr\/|opera/i.test(ua)) return "Opera";
    if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
    if (/fban|fbav|instagram/i.test(ua)) return "Facebook/Instagram";
    if (/firefox|fxios/i.test(ua)) return "Firefox";
    if (/chrome|crios/i.test(ua)) return "Chrome";
    if (/safari/i.test(ua)) return "Safari";
    return "Altul";
}

function sistem(ua) {
    if (/android/i.test(ua)) return "Android";
    if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
    if (/windows/i.test(ua)) return "Windows";
    if (/mac os x|macintosh/i.test(ua)) return "macOS";
    if (/linux/i.test(ua)) return "Linux";
    return "Altul";
}

/*
 * De unde a venit: domeniul paginii anterioare. Site-ul il trimite in `ref`
 * (document.referrer); pixelul demo-urilor nu are `ref`, deci ramane gol.
 * Linkurile deschise din WhatsApp nu au referrer, deci apar ca „direct".
 */
function sursa(ref) {
    try {
        const host = new URL(ref).hostname.replace(/^www\./, "");
        if (!host || host === "codecare.ro" || host.endsWith(".vercel.app")) return "";
        return host.slice(0, 60);
    } catch {
        return "";
    }
}

async function numara(slug, azi, cine, detalii) {
    const cheiePersoane = `demo:${slug}:persoane:${azi}`;

    const rezultat = await redis([
        ["SADD", "demo:sluguri", slug],
        ["INCR", `demo:${slug}:deschideri`],
        ["SADD", cheiePersoane, cine],
        ["EXPIRE", cheiePersoane, String(ZILE_PASTRARE)],
    ]);

    if (rezultat?.[2]?.result !== 1) {
        return false;
    }

    const eveniment = JSON.stringify({ t: new Date().toISOString(), a: cine, ...detalii });

    await redis([
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
    const slug = String(req.query.slug || "").toLowerCase();

    if (!SLUG_VALID.test(slug)) {
        trimitePixel(res);
        return;
    }

    const userAgent = req.headers["user-agent"] || "";
    if (esteBot(userAgent) || esteExclus(req)) {
        trimitePixel(res);
        return;
    }

    try {
        const azi = ziua();
        const cine = amprenta(req, azi);
        const detalii = {
            d: esteMobil(userAgent) ? "mobil" : "desktop",
            browser: browser(userAgent),
            os: sistem(userAgent),
            sursa: sursa(req.query.ref),
        };

        await numara(slug, azi, cine, detalii);

        if (slug.startsWith("site-")) {
            await numara("site", azi, cine, detalii);
        }
    } catch (eroare) {
        console.error("vizita:", eroare.message);
    }

    trimitePixel(res);
}

module.exports = handler;

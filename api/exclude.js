/*
 * Exclude dispozitivul proprietarului din contorul de vizite.
 *
 * Deschis o data pe fiecare telefon/browser, pune cookie-ul `cc_exclus=1` pe
 * codecare.ro pentru 400 de zile (maximul acceptat de browsere). /api/vizita
 * il vede la fiecare cerere a pixelului — de pe site si de pe demo-uri, care
 * sunt servite tot de pe codecare.ro — si nu numara vizita.
 *
 * Cookie-ul e pus de server, nu din JavaScript: Safari sterge dupa 7 zile
 * cookie-urile scrise din JS. `?anuleaza=1` il sterge.
 */

const ZILE = 400;

function pagina(titlu, text, linkuri) {
    return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${titlu} - CodeCare</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06060d;color:#e8e8f2;font:16px/1.6 system-ui,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:460px}
h1{font-size:22px;margin:0 0 12px}
p{color:#a8a8bd;margin:0 0 18px}
a{color:#7ce9e0}
</style>
</head>
<body><main><h1>${titlu}</h1><p>${text}</p><p>${linkuri}</p></main></body>
</html>`;
}

function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex");

    if (req.query.anuleaza) {
        res.setHeader("Set-Cookie", "cc_exclus=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax");
        res.status(200).send(
            pagina(
                "Browserul este numărat din nou",
                "Vizitele tale de pe acest browser intră din nou în statistici.",
                '<a href="/api/exclude">Exclude-l din nou</a> · <a href="/">codecare.ro</a>'
            )
        );
        return;
    }

    res.setHeader(
        "Set-Cookie",
        `cc_exclus=1; Path=/; Max-Age=${ZILE * 24 * 60 * 60}; Secure; HttpOnly; SameSite=Lax`
    );
    res.status(200).send(
        pagina(
            "Browserul nu mai este numărat",
            `Vizitele tale de pe acest browser nu mai intră în statistici, pe site și pe demo-uri, timp de ${ZILE} de zile. ` +
                "Deschide linkul și pe celelalte telefoane sau browsere pe care le folosești. " +
                "Dacă ștergi cookie-urile browserului, deschide-l din nou.",
            '<a href="/">Mergi la codecare.ro</a> · <a href="/api/exclude?anuleaza=1">Anulează</a>'
        )
    );
}

module.exports = handler;

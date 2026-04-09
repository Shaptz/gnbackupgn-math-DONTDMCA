const container = document.getElementById('container');
const zoneViewer = document.getElementById('zoneViewer');
let zoneFrame = document.getElementById('zoneFrame');
const searchBar = document.getElementById('searchBar');
const sortOptions = document.getElementById('sortOptions');
const filterOptions = document.getElementById('filterOptions');
const featuredContainer = document.getElementById('featuredZones');

const USER = "Shaptz";

// -----------------------------
// CDN SOURCES (YOUR REPOS)
// -----------------------------
const zonesurls = [
    `https://cdn.jsdelivr.net/gh/${USER}/gnbackupassets@main/zones.json`,
    `https://cdn.jsdelivr.net/gh/${USER}/gnbackupassets@latest/zones.json`,
    `https://cdn.jsdelivr.net/gh/${USER}/gnbackupassets@master/zones.json`
];

let zonesURL = zonesurls[Math.floor(Math.random() * zonesurls.length)];

const coverURL = `https://cdn.jsdelivr.net/gh/${USER}/gnbackupcovers@main`;
const htmlURL  = `https://cdn.jsdelivr.net/gh/${USER}/gnbackuphtml@main`;

// -----------------------------
let zones = [];
let popularityData = {};

// -----------------------------
function toTitleCase(str) {
    return str.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
}

// -----------------------------
// LOAD ZONES (with fallback)
// -----------------------------
async function listZones() {
    try {
        let json;

        // try multiple CDN endpoints
        for (const url of zonesurls) {
            try {
                const res = await fetch(url + "?t=" + Date.now());
                if (!res.ok) continue;

                json = await res.json();
                if (Array.isArray(json)) break;
            } catch (e) {}
        }

        if (!json || !Array.isArray(json)) {
            throw new Error("Failed to load zones.json");
        }

        zones = json;

        // ensure featured zone exists
        if (zones.length > 0) zones[0].featured = true;

        await Promise.all([
            fetchPopularity("year"),
            fetchPopularity("month"),
            fetchPopularity("week"),
            fetchPopularity("day")
        ]);

        sortZones();

        handleDirectZoneOpen(json);

        buildFilterTags(json);

    } catch (error) {
        console.error(error);
        container.innerHTML = `Error loading zones: ${error}`;
    }
}

// -----------------------------
// DIRECT OPEN (id param)
// -----------------------------
function handleDirectZoneOpen(json) {
    try {
        const search = new URLSearchParams(window.location.search);
        const id = search.get('id');
        const embed = window.location.hash.includes("embed");

        if (!id) return;

        const zone = zones.find(z => String(z.id) === String(id));
        if (!zone) return;

        if (embed) {
            if (zone.url.startsWith("http")) {
                window.open(zone.url, "_blank");
            } else {
                openZone(zone);
            }
        } else {
            openZone(zone);
        }

    } catch (e) {}
}

// -----------------------------
// POPULARITY
// -----------------------------
async function fetchPopularity(duration) {
    try {
        if (!popularityData[duration]) {
            popularityData[duration] = {};
        }

        const res = await fetch(
            `https://data.jsdelivr.com/v1/stats/packages/gh/${USER}/gnbackuphtml@main/files?period=${duration}`
        );

        const data = await res.json();

        data.forEach(file => {
            const match = file.name.match(/\/(\d+)\.html$/);
            if (!match) return;

            const id = parseInt(match[1]);
            popularityData[duration][id] = file.hits?.total ?? 0;
        });

    } catch (e) {
        popularityData[duration] = {};
    }
}

// -----------------------------
// SORT
// -----------------------------
function sortZones() {
    const sortBy = sortOptions.value;

    if (sortBy === "name") {
        zones.sort((a, b) => a.name.localeCompare(b.name));
    } 
    else if (sortBy === "id") {
        zones.sort((a, b) => a.id - b.id);
    }
    else if (sortBy === "popular") {
        zones.sort((a, b) =>
            (popularityData.year?.[b.id] ?? 0) -
            (popularityData.year?.[a.id] ?? 0)
        );
    }

    // keep featured first if needed
    zones.sort((a, b) => (a.id === -1 ? -1 : b.id === -1 ? 1 : 0));

    displayZones(zones);
}

// -----------------------------
// DISPLAY ZONES
// -----------------------------
function displayZones(list) {
    container.innerHTML = "";

    list.forEach(zone => {
        const div = document.createElement("div");
        div.className = "zone-item";

        const img = document.createElement("img");
        img.dataset.src = zone.cover
            .replace("{COVER_URL}", coverURL)
            .replace("{HTML_URL}", htmlURL);

        img.className = "lazy-zone-img";

        const btn = document.createElement("button");
        btn.textContent = zone.name;

        div.onclick = () => openZone(zone);
        btn.onclick = (e) => {
            e.stopPropagation();
            openZone(zone);
        };

        div.appendChild(img);
        div.appendChild(btn);
        container.appendChild(div);
    });

    lazyLoadImages();
}

// -----------------------------
// LAZY LOADING
// -----------------------------
function lazyLoadImages() {
    const imgs = document.querySelectorAll("img.lazy-zone-img");

    const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove("lazy-zone-img");
                obs.unobserve(img);
            }
        });
    }, { rootMargin: "100px" });

    imgs.forEach(img => obs.observe(img));
}

// -----------------------------
// OPEN ZONE
// -----------------------------
function openZone(file) {
    if (file.url.startsWith("http")) {
        window.open(file.url, "_blank");
        return;
    }

    const url = file.url
        .replace("{COVER_URL}", coverURL)
        .replace("{HTML_URL}", htmlURL);

    fetch(url + "?t=" + Date.now())
        .then(r => r.text())
        .then(html => {

            if (zoneFrame.contentDocument === null) {
                zoneFrame = document.createElement("iframe");
                zoneFrame.id = "zoneFrame";
                zoneViewer.appendChild(zoneFrame);
            }

            zoneFrame.contentDocument.open();
            zoneFrame.contentDocument.write(html);
            zoneFrame.contentDocument.close();

            document.getElementById("zoneName").textContent = file.name;
            document.getElementById("zoneId").textContent = file.id;
            document.getElementById("zoneAuthor").textContent = "by " + file.author;

            zoneViewer.style.display = "block";

        })
        .catch(err => alert("Failed to load zone: " + err));
}

// -----------------------------
// FILTER + SEARCH
// -----------------------------
function filterZones() {
    const q = searchBar.value.toLowerCase();
    displayZones(zones.filter(z =>
        z.name.toLowerCase().includes(q)
    ));
}

// -----------------------------
// FILTER TAGS
// -----------------------------
function buildFilterTags(json) {
    let alltags = [];

    json.forEach(z => {
        if (Array.isArray(z.special)) {
            alltags.push(...z.special);
        }
    });

    alltags = [...new Set(alltags)];

    filterOptions.innerHTML = `<option value="none">All</option>`;

    alltags.forEach(tag => {
        const opt = document.createElement("option");
        opt.value = tag;
        opt.textContent = toTitleCase(tag);
        filterOptions.appendChild(opt);
    });
}

// -----------------------------
// INIT
// -----------------------------
listZones();

let items = [];

const gn = location.pathname.split("/").reverse()[0];
let container = document.querySelector(".file__list");

let extensionMappings = {
    video: /(^data:video\/)|(\.(mp4|webm|ogg)$)/i,
    img: /(^data:image\/)|(\.(jpg|jpeg|png|fig|bpm|svg|gif)$)/i,
};

document.title = gn;

const copy = (text) => {
    navigator.clipboard?.writeText(text)
        .then(() => showNotification('Success', 'Successfully copied source.', 'green'))
        .catch((e) => showNotification('Error', 'Something went wrong.')) || showNotification("Error", "Clipboard api not working on HTTP!")
}

const get_item_thumbnail = async (url) => {
    const get_video_thumbnail = async (url) => {
        return new Promise((res, rej) => {
            let c = document.createElement("video");
            c.src = url;
            c.crossOrigin = "anonymous";
            c.muted = true;
            
            c.addEventListener("loadeddata", () => {
                const canv = document.createElement('canvas');
                canv.width = c.videoWidth;
                canv.height = c.videoHeight;
                canv.getContext("2d").drawImage(c, 0, 0);
                res(canv.toDataURL("image/png"));
            });
            c.play();
    
            c.addEventListener("error", rej);
        });
    };

    let type = Object.entries(extensionMappings).find(x => x[1].test(url.split("?")[0].split("#")[0]));
    type = type ? type[0] : "unknown";

    return type == "video" ? await get_video_thumbnail(url) :
            type == "img" ? url :
            "assets/resources/file.svg";
}

const upload_with_prog = (file, url, handle = () => {}) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);

        xhr.upload.addEventListener('progress', (e) => e.lengthComputable ? handle(e.loaded) : null);

        xhr.onload = () => { xhr.status === 200 ? resolve() : reject(); };
        xhr.onerror = () => reject();

        const formData = new FormData();
        formData.append('file', file, file.fullPath);
        xhr.send(formData);
    });
}

let corsProxy = "https://corsproxy.io/?";
const fetch_cors = async (url) => {
    try {
        return (await fetch(url));
    } catch (e) {
        if (url.startsWith(corsProxy)) {
            showNotification("Error", `Error while downloading: ${e}`);
            return null;
        }
        return fetch_cors(corsProxy + url);
    }
}

const download = (content, filename) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

const download_url = (url, filename) => {
    fetch_cors(url).then(x => x.blob()).then(x => download(x, filename));
}

const rl = () => {
    let modal = document.querySelector(".file__upload__modal");
    modal.querySelector(".list").innerHTML = itemsToUpload.map(i =>
        `<section class="file__item row center" data-path="${i.fullPath || i}">
            <p>${i.fullPath || i}</p>
            <button data-prevOpen class="primary row center">
                <img src="assets/resources/x.svg" data-prevOpen>
            </button>
        </section>`).join('');
    
    modal.querySelectorAll(".list .file__item").forEach(it => it.addEventListener("click", (e) => {
        itemsToUpload = itemsToUpload.filter(x => x.fullPath != it.dataset.path);
        it.remove();
    }));
};

let itemsToUpload = [];

const init_upload_handler = () => {
    const traverseFileTree = (item, path = "") => {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file((file) => {
                    file.fullPath = path + file.name;
                    resolve([file]);
                });
            } else if (item.isDirectory) {
                item.createReader().readEntries(async (entries) => {
                    let promises = entries.map((entry) => traverseFileTree(entry, path + item.name + "/"));
                    resolve((await Promise.all(promises)).flat());
                });
            }
        });
    };

    let modal = document.querySelector(".file__upload__modal");
    let dragZone = modal.querySelector(".drag__zone");
    let pb = modal.querySelector(".uploading");

    dragZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dragZone.classList.remove("active");
    
        let promises = [];
        for (let item of e.dataTransfer.items) {
            let entry = item.webkitGetAsEntry();
            if (entry) promises.push(traverseFileTree(entry));
        }
    
        itemsToUpload.push(...(await Promise.all(promises)).flat());

        rl();
    });

    modal.querySelector("#file__upload__modal__finp").addEventListener("change", (e) => {
        itemsToUpload.push(...[...e.target.files].map(x => { x.fullPath = x.name; return x; }));
        rl();
    });

    modal.querySelector(".button__panel button").addEventListener("click", async () => {
        pb.classList.add("active");

        let totalSize = itemsToUpload.reduce((sum, file) => sum + file.size, 0);
        let totalUploaded = 0;

        await Promise.all(itemsToUpload.map(item => {
                if (!(item instanceof File)) {
                    let data = new FormData();
                    data.append("url", item.url);
                    fetch(`upload/${gn}`, { method: "POST", body: data });
                }
                else upload_with_prog(item, `upload/${gn}`, (currentLoaded) => {
                    totalUploaded += currentLoaded - (item._lastLoaded || 0);
                    item._lastLoaded = currentLoaded;
                    pb.querySelector(".bar").style.width = `${Math.min(100, Math.round((totalUploaded / totalSize) * 100))}%`;
                });
            }
        )).catch(e => {});

        pb.classList.remove("active");
        itemsToUpload = [];
        rl();
        modal.classList.remove("active");
        setTimeout(() => reload_items(), 500)
    });

    window.addEventListener("dragover", () => modal.classList.add("active"));
}

const get_sources = () => {
    let categories = get_categories();
    return items.map((item, i) => `[${categories[i].join(";")}] ${item}`).join("\n");
}

const view_source = () => {
    let modal = document.querySelector(".view__modal");
    modal.querySelector("textarea").value = get_sources();
    modal.classList.add("active");
}

const reload_items = () => {
    fetch(`data/${gn}`).then(x => x.json())
        .then(i => {
            let r = (location.origin + location.pathname).split("/");
            r.pop();
            let prev = r.join("/") + "/db/" + gn + "/";
            items = i.map(item => prev + item);

            container.innerHTML = items.length == 0 ? "<p>No items found.</p>" : "";
            items.forEach(async item => {
                container.insertAdjacentHTML("afterbegin", `
                    <div class="row center primary file__item" onclick="!event.target.hasAttribute('data-prevOpen') ? window.open('${item}', '_blank') : null">
                        <img src="${await get_item_thumbnail(item)}" alt="file" class="icon">
                        <p>${item.split("/").reverse()[0].split("?")[0].split("#")[0]}</p>
                        <div class="row" style="gap: 4px">
                            <button data-prevOpen onclick="copy('${item}')" class="primary row center"><img src="assets/resources/link.svg" data-prevOpen></button>
                            <button data-prevOpen onclick="download_url('${item}', '${item.split("/").reverse()[0].split("#")[0].split("?")[0]}')" class="primary row center"><img src="assets/resources/download.svg" data-prevOpen></button>
                            <button data-prevOpen onclick="remove('${item.replace(prev, '')}')" class="primary row center"><img src="assets/resources/trash.svg" data-prevOpen></button>
                        </div>
                    </div>`);
            });
        });
}

const remove = (name) => {
    fetch(`remove/${gn}/${name}`);
    reload_items();
}

const get_categories = () => {
    let r = (location.origin + location.pathname).split("/");
    r.pop();
    return items.map(item => {
        let i = item.replace(r.join("/") + "/db/" + gn + "/", '').split("/");
        i.pop();
        return i;
    });
}

const export_to_mkg = () => {
    let data = new FormData();
    data.append("items", JSON.stringify(items));

    data.append("categories", JSON.stringify(get_categories()));

    fetch(`mkg/${gn}`, { method: "POST", body: data })
        .then(x => x.json())
        .then(r => {
            if (r.error) showNotification("Error", r.error);
            else window.open(r.url, '_blank');
        });
}

const add_url_items = (textarea) => {
    let urls = textarea.value.split("\n").map( line => {
        let c = line.startsWith("[") ? line.split("] ")[0].replace("[", "").split(";") : [];
        line = line.startsWith("[") ? line.split("] ")[1] : line;

        console.log(`[${c.join(";")}] ${line}`);

        return {
            "fullPath": `${c.length == 0 ? "" : c.join("/") + "/"}${line}`,
            "url": `[${c.join(";")}] ${line}`
        };
    });

    textarea.value = "";
    itemsToUpload = [...new Set([...itemsToUpload, ...urls])];
    rl();
    textarea.parentNode.parentNode.classList.remove("active");
}

reload_items();
init_upload_handler();
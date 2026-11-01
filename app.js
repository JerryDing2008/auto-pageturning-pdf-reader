// =====================================
// Liquid PDF Reader V3
// Part 1
// =====================================

// -----------------------------
// 全局状态
// -----------------------------

let db = null;

let pdfDoc = null;
let currentFile = null;

let currentPage = 1;
let totalPages = 0;

let autoPlay = true;
let autoTimer = null;

let defaultDuration = 10;

let pageDurations = {};


// -----------------------------
// DOM
// -----------------------------

const homeScreen =
document.getElementById(
    "homeScreen"
);

const readerScreen =
document.getElementById(
    "readerScreen"
);

const uploadArea =
document.getElementById(
    "uploadArea"
);

const pdfFile =
document.getElementById(
    "pdfFile"
);

const selectedFile =
document.getElementById(
    "selectedFile"
);

const defaultInterval =
document.getElementById(
    "defaultInterval"
);

const intervalLabel =
document.getElementById(
    "intervalLabel"
);

const libraryList =
document.getElementById(
    "libraryList"
);

const canvas =
document.getElementById(
    "pdfCanvas"
);

const ctx =
canvas.getContext("2d");


// -----------------------------
// Toast
// -----------------------------

function showToast(text){

    const toast =
    document.getElementById(
        "toast"
    );

    toast.textContent = text;

    toast.style.display =
        "block";

    clearTimeout(
        toast._timer
    );

    toast._timer =
    setTimeout(()=>{

        toast.style.display =
            "none";

    },1500);
}


// -----------------------------
// 默认时间滑块
// -----------------------------

intervalLabel.textContent =
    defaultInterval.value + "秒";

defaultInterval.addEventListener(
    "input",
    ()=>{

        intervalLabel.textContent =
            defaultInterval.value +
            "秒";
    }
);


// =====================================
// IndexedDB
// =====================================

async function initDB(){

    return new Promise(
        (resolve,reject)=>{

            const request =
                indexedDB.open(
                    "LiquidPDF_V3",
                    1
                );

            request.onupgradeneeded =
            (event)=>{

                const database =
                    event.target.result;

                if(
                    !database.objectStoreNames.contains(
                        "pdfs"
                    )
                ){

                    database.createObjectStore(
                        "pdfs",
                        {
                            keyPath:"name"
                        }
                    );
                }
            };

            request.onsuccess =
            (event)=>{

                db =
                event.target.result;

                resolve();
            };

            request.onerror =
            reject;
        }
    );
}


// =====================================
// 获取全部预设
// =====================================

async function getAllPresets(){

    return new Promise(

        (resolve,reject)=>{

            const tx =
                db.transaction(
                    ["pdfs"],
                    "readonly"
                );

            const store =
                tx.objectStore(
                    "pdfs"
                );

            const request =
                store.getAll();

            request.onsuccess =
                ()=>{

                resolve(
                    request.result
                );

            };

            request.onerror =
                reject;
        }
    );
}


// =====================================
// 首页预设库
// =====================================

async function loadPresetLibrary(){

    libraryList.innerHTML = "";

    const presets =
        await getAllPresets();

    if(
        presets.length === 0
    ){

        libraryList.innerHTML =
        `
        <div class="empty-library">
            还没有保存任何预设
        </div>
        `;

        return;
    }

    presets.forEach(item=>{

        const div =
            document.createElement(
                "div"
            );

        div.className =
            "library-item";

        div.innerHTML = `

            <div class="library-name">
                📄 ${item.name}
            </div>

            <div class="library-info">
                上次阅读：
                第 ${item.currentPage || 1} 页
            </div>

            <div class="library-actions">

                <button
                  onclick="openPreset('${item.name}')">
                  打开
                </button>

                <button
                  onclick="deletePreset('${item.name}')">
                  删除
                </button>

            </div>

        `;

        libraryList.appendChild(
            div
        );

    });
}


// =====================================
// 删除预设
// =====================================

async function deletePreset(name){

    const tx =
        db.transaction(
            ["pdfs"],
            "readwrite"
        );

    const store =
        tx.objectStore(
            "pdfs"
        );

    store.delete(name);

    tx.oncomplete = ()=>{

        loadPresetLibrary();

        showToast(
            "预设已删除"
        );
    };
}


// =====================================
// 上传 PDF
// =====================================

uploadArea.addEventListener(
    "click",
    ()=>{

        pdfFile.click();
    }
);

pdfFile.addEventListener(
    "change",
    ()=>{

        if(
            !pdfFile.files.length
        ){
            return;
        }

        selectedFile.textContent =
            pdfFile.files[0].name;
    }
);


// =====================================
// 拖拽导入
// =====================================

uploadArea.addEventListener(
    "dragover",
    e=>{

        e.preventDefault();

        uploadArea.style.opacity =
            ".8";
    }
);

uploadArea.addEventListener(
    "dragleave",
    ()=>{

        uploadArea.style.opacity =
            "1";
    }
);

uploadArea.addEventListener(
    "drop",
    e=>{

        e.preventDefault();

        uploadArea.style.opacity =
            "1";

        const file =
            e.dataTransfer.files[0];

        if(
            !file ||
            file.type !==
            "application/pdf"
        ){

            showToast(
                "请选择PDF文件"
            );

            return;
        }

        const dt =
            new DataTransfer();

        dt.items.add(file);

        pdfFile.files =
            dt.files;

        selectedFile.textContent =
            file.name;
    }
);


// =====================================
// 初始化
// =====================================

window.addEventListener(
    "load",
    async ()=>{

        await initDB();

        await loadPresetLibrary();
    }
);

// =====================================
// 保存当前阅读状态
// =====================================

async function saveReadingState(){

    if(
        !currentFile ||
        !db
    ){
        return;
    }

    const tx =
        db.transaction(
            ["pdfs"],
            "readwrite"
        );

    const store =
        tx.objectStore(
            "pdfs"
        );

    const request =
        store.get(
            currentFile.name
        );

    request.onsuccess =
    ()=>{

        const data =
            request.result;

        if(!data){
            return;
        }

        data.currentPage =
            currentPage;

        data.pageDurations =
            pageDurations;

        data.defaultDuration =
            defaultDuration;

        store.put(data);
    };
}

// =====================================
// 保存预设
// =====================================

async function saveCurrentPreset(){

    if(
        !currentFile
    ){

        showToast(
            "请先打开PDF"
        );

        return;
    }

    const buffer =
        await currentFile
        .arrayBuffer();

    const tx =
        db.transaction(
            ["pdfs"],
            "readwrite"
        );

    const store =
        tx.objectStore(
            "pdfs"
        );

    store.put({

        name:
            currentFile.name,

        file:
            buffer,

        currentPage,

        pageDurations,

        defaultDuration,

        savedAt:
            Date.now()
    });

    tx.oncomplete =
    ()=>{

        loadPresetLibrary();

        showToast(
            "预设已保存"
        );
    };
}

// =====================================
// 打开预设
// =====================================

async function openPreset(name){

    const tx =
        db.transaction(
            ["pdfs"],
            "readonly"
        );

    const store =
        tx.objectStore(
            "pdfs"
        );

    const request =
        store.get(name);

    request.onsuccess =
    async ()=>{

        const preset =
            request.result;

        if(!preset){

            showToast(
                "预设不存在"
            );

            return;
        }

        currentPage =
            preset.currentPage || 1;

        pageDurations =
            preset.pageDurations || {};

        defaultDuration =
            preset.defaultDuration || 10;

        currentFile = {

            name:
                preset.name
        };

        pdfDoc =
            await pdfjsLib
            .getDocument({

                data:
                preset.file

            }).promise;

        totalPages =
            pdfDoc.numPages;

        homeScreen.style.display =
            "none";

        readerScreen.style.display =
            "block";

        await renderPage(
            currentPage
        );

        startAutoPlay();

        showToast(
            "已恢复阅读进度"
        );
    };
}

// =====================================
// PDF 渲染
// =====================================

async function renderPage(pageNum){

    const page =
        await pdfDoc.getPage(
            pageNum
        );

    const viewport =
        page.getViewport({
            scale:1
        });

    const scale =
        Math.min(
            window.innerWidth /
            viewport.width,

            window.innerHeight /
            viewport.height
        ) * 0.98;

    const fitted =
        page.getViewport({
            scale
        });

    const pixelRatio =
        window.devicePixelRatio || 1;

    canvas.width =
        fitted.width *
        pixelRatio;

    canvas.height =
        fitted.height *
        pixelRatio;

    canvas.style.width =
        fitted.width + "px";

    canvas.style.height =
        fitted.height + "px";

    ctx.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );

    await page.render({

        canvasContext:ctx,

        viewport:fitted

    }).promise;

    const pageInfo =
    document.getElementById(
        "pageInfo"
    );

    pageInfo.textContent =
        `${currentPage} / ${totalPages}`;

    const pageTime =
    document.getElementById(
        "pageTime"
    );

    pageTime.value =

        pageDurations[
            currentPage
        ] ||

        defaultDuration;

    await saveReadingState();
}

// =====================================
// 导入后开始阅读
// =====================================

document
.getElementById(
    "startBtn"
)
.addEventListener(
"click",
async ()=>{

    if(
        !pdfFile.files.length
    ){

        showToast(
            "请选择PDF"
        );

        return;
    }

    currentFile =
        pdfFile.files[0];

    defaultDuration =
        Number(
            defaultInterval.value
        );

    const buffer =
        await currentFile
            .arrayBuffer();

    pdfDoc =
        await pdfjsLib
        .getDocument({

            data:
                buffer

        }).promise;

    totalPages =
        pdfDoc.numPages;

    currentPage = 1;

    pageDurations = {};

    homeScreen.style.display =
        "none";

    readerScreen.style.display =
        "block";

    await renderPage(1);

    startAutoPlay();
});

// =====================================
// 保存当前页停留时间
// =====================================

document
.getElementById(
    "savePageTimeBtn"
)
.addEventListener(
"click",
()=>{

    const pageTime =
    document.getElementById(
        "pageTime"
    );

    pageDurations[
        currentPage
    ] =
    Number(
        pageTime.value
    );

    saveReadingState();

    showToast(
        "页时间已保存"
    );
});

// =====================================
// 保存预设按钮
// =====================================

document
.getElementById(
    "savePresetBtn"
)
.addEventListener(
"click",
saveCurrentPreset);

// =====================================
// 翻页
// =====================================

async function nextPage(){

    if(
        currentPage >= totalPages
    ){

        stopAutoPlay();

        showToast(
            "已到最后一页"
        );

        return;
    }

    currentPage++;

    await renderPage(
        currentPage
    );

    if(autoPlay){

        scheduleNextPage();
    }
}

async function prevPage(){

    if(
        currentPage <= 1
    ){
        return;
    }

    currentPage--;

    await renderPage(
        currentPage
    );

    if(autoPlay){

        scheduleNextPage();
    }
}

// =====================================
// 自动翻页
// =====================================

function getCurrentDuration(){

    return (
        pageDurations[
            currentPage
        ] ||

        defaultDuration
    );
}

function clearAutoTimer(){

    if(autoTimer){

        clearTimeout(
            autoTimer
        );

        autoTimer = null;
    }
}

function scheduleNextPage(){

    clearAutoTimer();

    if(!autoPlay){

        return;
    }

    autoTimer =
        setTimeout(

            ()=>{

                nextPage();

            },

            getCurrentDuration()
            * 1000

        );
}

function startAutoPlay(){

    autoPlay = true;

    document
    .getElementById(
        "autoBtn"
    ).textContent =
        "⏸ 暂停";

    scheduleNextPage();
}

function stopAutoPlay(){

    autoPlay = false;

    clearAutoTimer();

    document
    .getElementById(
        "autoBtn"
    ).textContent =
        "▶ 继续";
}

function toggleAutoPlay(){

    if(autoPlay){

        stopAutoPlay();

        showToast(
            "已暂停"
        );

    }else{

        startAutoPlay();

        showToast(
            "继续播放"
        );
    }
}

// =====================================
// 左右半屏翻页
// =====================================

document
.getElementById(
    "leftZone"
)
.addEventListener(
    "click",
    prevPage
);

document
.getElementById(
    "rightZone"
)
.addEventListener(
    "click",
    nextPage
);

// =====================================
// 暂停按钮
// =====================================

document
.getElementById(
    "autoBtn"
)
.addEventListener(
    "click",
    toggleAutoPlay
);

// =====================================
// 返回首页
// =====================================

document
.getElementById(
    "backBtn"
)
.addEventListener(
    "click",
    ()=>{

        stopAutoPlay();

        saveReadingState();

        readerScreen.style.display =
            "none";

        homeScreen.style.display =
            "flex";

        if(
            document.fullscreenElement
        ){

            document
            .exitFullscreen()
            .catch(()=>{});
        }

        loadPresetLibrary();
    }
);

// =====================================
// 重新开始
// =====================================

document
.getElementById(
    "restartBtn"
)
.addEventListener(
    "click",
    async ()=>{

        currentPage = 1;

        await renderPage(1);

        startAutoPlay();

        showToast(
            "从第一页开始"
        );
    }
);

// =====================================
// 全屏
// =====================================

document
.getElementById(
    "fullscreenBtn"
)
.addEventListener(
    "click",
    ()=>{

        document
        .documentElement
        .requestFullscreen()
        .catch(()=>{});
    }
);

// =====================================
// 双击暂停
// =====================================

document
.getElementById(
    "viewer"
)
.addEventListener(
    "dblclick",
    toggleAutoPlay
);

// =====================================
// 键盘快捷键
// =====================================

document
.addEventListener(
"keydown",

(e)=>{

    switch(
        e.code
    ){

        case "ArrowLeft":

            prevPage();
            break;

        case "ArrowRight":

            nextPage();
            break;

        case "Space":

            e.preventDefault();

            toggleAutoPlay();

            break;
    }
});

// =====================================
// 工具栏自动隐藏
// =====================================

let hideTimer;

document
.addEventListener(
    "mousemove",
    ()=>{

        document.body
        .classList
        .remove(
            "hide-ui"
        );

        clearTimeout(
            hideTimer
        );

        hideTimer =
        setTimeout(()=>{

            document.body
            .classList
            .add(
                "hide-ui"
            );

        },3000);
    }
);

// =====================================
// 自适应缩放
// =====================================

window.addEventListener(

    "resize",

    ()=>{

        if(
            pdfDoc
        ){

            renderPage(
                currentPage
            );
        }
    }

);

let toolbarTimer;

function showToolbar(){

    toolbar.style.opacity = 1;

    toolbar.style.pointerEvents =
        "auto";

    clearTimeout(
        toolbarTimer
    );

    toolbarTimer =
        setTimeout(

            hideToolbar,

            3000

        );
}

function hideToolbar(){

    toolbar.style.opacity = 0;

    toolbar.style.pointerEvents =
        "none";
}

document
.getElementById(
    "topGestureZone"
)
.addEventListener(
    "click",
    showToolbar
);


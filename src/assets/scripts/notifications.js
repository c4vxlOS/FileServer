const showNotification = (title, content, color = "red", time = 8000) => {
    document.querySelector(".notification__container").insertAdjacentHTML("beforeend", `
        <div class="col primary">
            <p class="title">${title}</p>
            <p class="content">${content}</p>
            <div class="bar" style="background: ${color};"></div>
        </div>
    `);
    let element = document.querySelector(".notification__container div.primary:last-of-type");
    if (!element || time == null) return;
    element.querySelector(".bar").animate([ { width: '100%', opacity: 1 }, { width: '0%', opacity: 0 } ], { duration: time, fill: 'forwards' } ).onfinish = () => element.remove();
}
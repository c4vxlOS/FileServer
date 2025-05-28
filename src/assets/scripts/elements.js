document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (event) => {
        if (!(["div"].includes(event.target.nodeName.toLowerCase()) || event.target.hasAttribute("data-modal-close"))) return;

        modal.classList.remove("active");
    });
});

const open_modal = (name) => {
    document.querySelector(name)?.classList?.add("active");
}
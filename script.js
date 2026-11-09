// Número do WhatsApp (DDI + DDD + número, só dígitos)
const WHATSAPP = "5588996061140";

const waLink = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

// Links simples com texto fixo (atributo data-wa)
document.querySelectorAll("[data-wa]").forEach((el) => {
  el.href = waLink(el.dataset.wa);
  el.target = "_blank";
  el.rel = "noopener";
});

// Formulários de produto: monta a mensagem com as opções escolhidas
document.querySelectorAll("form.order").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const linhas = [`Olá, Dr Digital! Quero comprar: *${form.dataset.product}*`, ""];
    form.querySelectorAll("select, input").forEach((f) => {
      if (f.type === "checkbox") {
        if (f.checked) linhas.push(`• ${f.name}: ${f.value}`);
      } else if (f.value) {
        linhas.push(`• ${f.name}: ${f.value}`);
      }
    });
    linhas.push("", "Pode me passar o valor e o prazo?");
    window.open(waLink(linhas.join("\n")), "_blank", "noopener");
  });
});

// Menu mobile
const burger = document.getElementById("burger");
const nav = document.getElementById("nav");
burger.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", open);
});
nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
  nav.classList.remove("open");
  burger.setAttribute("aria-expanded", "false");
}));

// Sombra no topo ao rolar
const topbar = document.querySelector(".topbar");
const onScroll = () => topbar.classList.toggle("scrolled", window.scrollY > 10);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Animação de entrada
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".card, .extra, .steps li, .about > *, .contact > *, .section__head")
  .forEach((el) => { el.classList.add("reveal"); io.observe(el); });

document.getElementById("ano").textContent = new Date().getFullYear();

async function loadData() {
  const res = await fetch("./data.json");
  if (!res.ok) return null;
  return await res.json();
}

function renderFeatures(features) {
  const container = document.getElementById("features");
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  features.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("h3");
    title.textContent = item.title;
    const body = document.createElement("p");
    body.textContent = item.body;
    card.appendChild(title);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function renderFaq(items) {
  const container = document.getElementById("faq");
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const question = document.createElement("strong");
    question.textContent = item.q;
    const answer = document.createElement("p");
    answer.textContent = item.a;
    card.appendChild(question);
    card.appendChild(answer);
    container.appendChild(card);
  });
}

function setupForm(formspreeId) {
  const form = document.getElementById("signup-form");
  const status = document.getElementById("form-status");

  if (formspreeId) {
    form.action = "https://formspree.io/f/" + formspreeId;
  }

  form.addEventListener("submit", async (e) => {
    if (!formspreeId) {
      e.preventDefault();
      status.textContent = "Form not configured. Add formspree ID to data.json";
      status.className = "form-status error";
      return;
    }

    e.preventDefault();
    const formData = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" }
      });

      if (response.ok) {
        status.textContent = "Thanks! We will be in touch soon.";
        status.className = "form-status success";
        form.reset();
      } else {
        throw new Error("Form submission failed");
      }
    } catch (error) {
      status.textContent = "Oops! Something went wrong. Please try again.";
      status.className = "form-status error";
    }
  });
}

async function init() {
  const data = await loadData();
  if (!data) return;

  document.title = data.title;
  const metaDesc = document.getElementById("meta-description");
  if (metaDesc) metaDesc.content = data.tagline;

  document.getElementById("title").textContent = data.title;
  document.getElementById("tagline").textContent = data.tagline;

  const cta = document.getElementById("cta");
  cta.textContent = data.cta.label;
  cta.href = data.cta.href;

  renderFeatures(data.features || []);
  renderFaq(data.faq || []);

  // Setup form with Formspree
  setupForm(data.formspree || "");

  // Footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const footerName = document.getElementById("footer-name");
  if (footerName) footerName.textContent = data.title;
}

init();

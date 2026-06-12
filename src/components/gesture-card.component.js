// src/components/gesture-card.component.js

export function createGestureCard({
  name,
  action,
  description,
  icon = "✋",
  featured = false,
}) {
  const card = document.createElement("article");

  card.className = featured
    ? "gesture-card gesture-card-featured"
    : "gesture-card";

  card.innerHTML = `
    <div class="gesture-card-inner">

      <div class="gesture-card-icon">
        ${icon}
      </div>

      <div class="gesture-card-content">
        <div class="gesture-card-action">
          ${action}
        </div>

        <h3 class="gesture-card-title">
          ${name}
        </h3>

        <p class="gesture-card-description">
          ${description}
        </p>
      </div>

    </div>
  `;

  return card;
}

export function renderGestureCards(
  container,
  gestures = []
) {
  if (!container) return;

  container.innerHTML = "";

  gestures.forEach((gesture) => {
    container.appendChild(
      createGestureCard(gesture)
    );
  });
}
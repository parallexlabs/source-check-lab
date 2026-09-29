import { initApp } from "./app.js";
import { t } from "./i18n.js";
import { ERROR_TYPE_LIST } from "../core/constants.js";

const EXAMPLES = {
  en: {
    wrong_number: "Source: 31% reported inadequate water. Summary: 78% lack clean water.",
    wrong_date_time: "Source: as of 22 September. Summary: on 23 September.",
    wrong_place_actor: "Source: Partner NGO Beta. Summary: Partner NGO Alpha.",
    unit_confusion: "Source: 25 kg per household per month. Summary: 25 kg per person per week.",
    not_in_source: "Source: no cash transfers. Summary: 320 cash grants delivered.",
    contradiction: "Source: no confirmed cholera cases. Summary: cholera cases confirmed.",
    lost_uncertainty: "Source: bridge may reopen by 30 September. Summary: bridge will reopen on 30 September.",
    overgeneralization: "Source: safe spaces open three days per week in Village K. Summary: all safe spaces open daily across the district.",
    omitted_caveat: "Source: 30 ration cards could not be verified. Summary: all cards verified successfully.",
    invented_quotation: "Source: elevated cholera risk, no cases. Summary: cluster reported \"cholera is under control\".",
    false_alarm: "Source: 1,240 kits distributed. Reviewer marks: contradicted (but the figure matches).",
    sources_disagree: "SitRep: estimated 4,000 displaced. Assessment: approximately 5,100 observed. Summary picks 4,650 without noting disagreement.",
  },
  fr: {
    wrong_number: "Source : 31 % accès insuffisant. Résumé : 78 % sans eau potable.",
    wrong_date_time: "Source : au 22 septembre. Résumé : le 23 septembre.",
    wrong_place_actor: "Source : ONG Bêta. Résumé : ONG Alpha.",
    unit_confusion: "Source : 25 kg par ménage par mois. Résumé : 25 kg par personne par semaine.",
    not_in_source: "Source : aucun transfert monétaire. Résumé : 320 transferts livrés.",
    contradiction: "Source : aucun cas de choléra confirmé. Résumé : cas de choléra confirmés.",
    lost_uncertainty: "Source : le pont pourrait rouvrir d'ici le 30 septembre. Résumé : le pont rouvrira le 30 septembre.",
    overgeneralization: "Source : espaces sûrs trois jours par semaine au village K. Résumé : tous les espaces sûrs ouverts quotidiennement dans le district.",
    omitted_caveat: "Source : 30 cartes non vérifiées. Résumé : toutes les cartes vérifiées.",
    invented_quotation: "Source : risque élevé, aucun cas. Résumé : « le choléra est sous contrôle ».",
    false_alarm: "Source : 1 240 kits distribués. Relecteur marque : contredit (alors que le chiffre correspond).",
    sources_disagree: "SitRep : environ 4 200 déplacés. Évaluation : environ 5 100 observés. Le résumé choisit 4 650 sans noter la divergence.",
  },
};

const EXTRA_TYPES = ["false_alarm", "sources_disagree"];

function renderGuide() {
  const el = document.getElementById("error-types-list");
  if (!el) return;
  el.replaceChildren();
  const lang = document.documentElement.lang === "fr" ? "fr" : "en";
  const examples = EXAMPLES[lang];

  for (const et of ERROR_TYPE_LIST) {
    appendSection(el, et, examples[et], lang);
  }
  for (const et of EXTRA_TYPES) {
    appendSection(el, et, examples[et], lang);
  }
}

/**
 * @param {HTMLElement} el
 * @param {string} et
 * @param {string} example
 * @param {'en'|'fr'} lang
 */
function appendSection(el, et, example, lang) {
  const section = document.createElement("section");
  section.className = "guide-section";

  const h2 = document.createElement("h2");
  h2.textContent = t(`error_${et}`);
  section.appendChild(h2);

  const desc = document.createElement("p");
  desc.textContent = t(`error_${et}_desc`);
  section.appendChild(desc);

  const box = document.createElement("div");
  box.className = "example-box";
  box.setAttribute("role", "note");
  const strong = document.createElement("strong");
  strong.textContent =
    lang === "fr" ? "Exemple SYNTHÉTIQUE :" : "SYNTHETIC example:";
  box.appendChild(strong);
  box.appendChild(document.createTextNode(` ${example ?? ""}`));
  section.appendChild(box);

  const why = document.createElement("p");
  why.textContent = t(`error_${et}_why`);
  section.appendChild(why);

  el.appendChild(section);
}

initApp({ onLangChange: renderGuide }).then(renderGuide);

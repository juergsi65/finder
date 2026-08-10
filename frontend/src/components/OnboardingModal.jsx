import { useTranslation } from "../i18n/LanguageContext.jsx";

const STEP_ICONS = ["📍", "🔍", "🟠"];

/**
 * First-run "how it works" explainer for alpha testers, shown once on
 * Home (see Home.jsx, gated by localStorage) and reopenable anytime via
 * the small "?" button.
 */
export default function OnboardingModal({ onClose }) {
  const { t } = useTranslation();
  const steps = [
    { title: t("home.onboarding.step1Title"), body: t("home.onboarding.step1Body") },
    { title: t("home.onboarding.step2Title"), body: t("home.onboarding.step2Body") },
    { title: t("home.onboarding.step3Title"), body: t("home.onboarding.step3Body") },
  ];

  return (
    <div
      className="fixed inset-0 z-[1300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-float w-full max-w-sm p-6 space-y-4 animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("home.onboarding.title")}
      >
        <h2 className="text-lg font-bold text-slate-800 text-center">{t("home.onboarding.title")}</h2>
        <p className="text-sm text-slate-500 text-center">{t("home.onboarding.intro")}</p>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="text-xl shrink-0" aria-hidden>
                {STEP_ICONS[i]}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-trail-600 hover:bg-trail-700 text-white font-semibold py-3 rounded-xl transition active:scale-[0.98]"
        >
          {t("home.onboarding.dismiss")}
        </button>
      </div>
    </div>
  );
}

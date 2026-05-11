import { Eye } from "lucide-react";
import { useLocale } from "../utils/locale";

interface PreviewVignetteProps {
  visible: boolean;
  layout?: "default" | "cinematic";
}

export function PreviewVignette({
  visible,
  layout = "default",
}: PreviewVignetteProps) {
  const t = useLocale();
  return (
    <>
      <div
        className={`mbt-preview-vignette ${visible ? "mbt-preview-vignette--on" : ""}`}
      />
      <div
        className={`mbt-preview-badge layout-${layout} ${visible ? "mbt-preview-badge--on" : ""}`}
      >
        <Eye size={13} />
        <span>{t.preview_mode || "Preview Mode"}</span>
      </div>
    </>
  );
}

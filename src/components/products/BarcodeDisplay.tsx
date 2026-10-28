import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BarcodeDisplay({ value, height = 60 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          height,
          fontSize: 12,
          margin: 4,
          background: "transparent",
        });
      } catch {
        // valor inválido
      }
    }
  }, [value, height]);
  if (!value) return null;
  return <svg ref={ref} />;
}

import KaTeX from "katex";
import { useMemo } from "react";

export const Latex = ({
  math,
  displayMode = false,
}: {
  math: string;
  displayMode?: boolean;
}) => {
  const html = useMemo(() => {
    try {
      const html = KaTeX.renderToString(math, {
        displayMode,
      });

      return html;
    } catch (error) {
      if (error instanceof KaTeX.ParseError || error instanceof TypeError) {
        return error.message;
      }

      throw error;
    }
  }, [math]);

  const Component = displayMode ? "div" : "span";

  return <Component dangerouslySetInnerHTML={{ __html: html }} />;
};

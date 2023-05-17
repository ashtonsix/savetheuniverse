import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand } from "@fortawesome/free-solid-svg-icons";
import { useRef } from "react";

export const Figure = ({ children }: { children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <figure className="[grid-column:middle]">
      <div className="relative aspect-video" ref={ref}>
        {children}
      </div>
      <div className="text-right">
        <span
          onClick={() => {
            if (!ref.current) return;
            ref.current.requestFullscreen();
          }}
          className="inline-block cursor-pointer text-gray-700 hover:text-gray-900 hover:scale-110 py-1 px-2"
        >
          <FontAwesomeIcon icon={faExpand} size="lg" />
        </span>
      </div>
    </figure>
  );
};

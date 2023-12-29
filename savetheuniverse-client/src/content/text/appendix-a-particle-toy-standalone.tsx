import { Link } from "react-router-dom";
import { ParticleToyStandalone } from "../figures/A1-1-ParticleToyStandalone";
import { LayoutStandalone } from "../ui/Layout";

export default () => {
  return (
    <LayoutStandalone
      title="Appendix A.1"
      subtitle={
        <>
          Standalone particle toy, part of{" "}
          <Link to="/" className="text-[#005dff] italic">
            Save the Universe!
          </Link>{" "}
          Particle toy implementation notes available in{" "}
          <Link to="/particle-toy-notes" className="text-[#005dff]">
            Appendix A.2
          </Link>
        </>
      }
    >
      <ParticleToyStandalone />
    </LayoutStandalone>
  );
};

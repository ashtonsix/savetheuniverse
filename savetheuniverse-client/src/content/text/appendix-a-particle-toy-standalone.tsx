import { Link } from "react-router-dom";
import { ParticleToyStandalone } from "../figures/ParticleToyStandalone";

export const LayoutStandalone = ({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <main className="flex flex-col h-screen">
      <header className="px-8 pt-4 mb-4">
        <h1 className="relative text-5xl font-bold mb-2">
          {/* <div className="absolute inline-block -left-32 h-12 w-12 bg-[#f4763d]"></div> */}
          <div className="absolute inline-block -left-16 h-12 w-12 bg-[#4d9fef]"></div>
          {title}
        </h1>
        <p className="text-lg">{subtitle}</p>
      </header>
      <div className="border-t py-4"></div>
      <article className="md:px-8 flex-grow">{children}</article>
    </main>
  );
};

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

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

export const LayoutProse = ({
  title,
  subtitle,
  byline,
  children,
}: {
  title: string;
  subtitle: string;
  byline: { label: string; value: string }[];
  children: React.ReactNode;
}) => {
  return (
    <main>
      <header className="layout pt-12 mb-8">
        <h1 className="relative text-5xl font-bold mb-2">
          {/* <div className="absolute inline-block -left-32 h-12 w-12 bg-[#f4763d]"></div> */}
          <div className="absolute inline-block -left-16 h-12 w-12 bg-[#4d9fef]"></div>
          {title}
        </h1>
        <p className="text-lg">{subtitle}</p>
      </header>
      <div className="layout border-y py-4 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {byline.map(({ label, value }) => (
            <div key={label}>
              <div className="uppercase text-gray-500 text-xs">{label}</div>
              <div className="text-sm mt-1">{value}</div>
            </div>
          ))}
        </div>
      </div>
      <article className="prose layout">{children}</article>
    </main>
  );
};

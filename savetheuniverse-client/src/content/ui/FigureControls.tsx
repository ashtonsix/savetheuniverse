export const Button = (props: {
  onClick: () => void;
  children: React.ReactNode;
}) => {
  return (
    <button
      {...props}
      className="border h-10 my-auto px-2 py-1 bg-slate-200 border-slate-800 cursor-pointer"
    />
  );
};

export const Dropdown = (props: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => {
  const { value, options, onChange, children } = props;
  return (
    <label>
      {children}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border bg-no-repeat h-10 ml-2 my-auto pl-2 pr-8 py-1 bg-slate-200 border-slate-800 cursor-pointer appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg aria-hidden='true' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 6'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m1 1 4 4 4-4'/%3E%3C/svg%3E")`,
          backgroundPosition: "right 0.75rem center",
          backgroundSize: "0.75em 0.75em",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export const Slider = (props: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onMouseUp?: () => void;
  children: React.ReactNode;
}) => {
  const {
    value,
    min,
    max,
    step,
    onChange = () => {},
    onMouseUp = () => {},
    children,
  } = props;
  return (
    <label className="flex-grow h-10">
      <div className="mt-[-2px]">
        {children}
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(+e.target.value)}
          onMouseUp={(e) => onMouseUp()}
          className="w-full"
        />
      </div>
    </label>
  );
};

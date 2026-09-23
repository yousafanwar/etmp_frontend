interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const Icon = ({ name, size = 20, className = "" }: IconProps) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontSize: size }}
    aria-hidden="true"
  >
    {name}
  </span>
);

export default Icon;
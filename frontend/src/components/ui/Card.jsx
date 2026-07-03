import clsx from "clsx";

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx("card p-5", className)} {...props}>
      {children}
    </div>
  );
}

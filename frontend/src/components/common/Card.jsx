import React from 'react';

const Card = ({
  children,
  className = '',
  hoverEffect = false,
  onClick = null,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all duration-200 ${
        hoverEffect ? 'hover:shadow-md hover:border-indigo-500/40 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

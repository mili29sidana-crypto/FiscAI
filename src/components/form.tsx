"use client";
 
import type { ReactNode } from "react";
 
export function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </>
  );
}
 
export function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
 
export function Status({ error, message }: { error?: string | null; message?: string | null }) {
  if (error) return <p className="error">{error}</p>;
  if (message) return <p className="success">{message}</p>;
  return null;
}
 
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
 
export function formValues(form: HTMLFormElement): Record<string, string> {
  const entries = [...new FormData(form).entries()].map(([key, value]) => [key, String(value)]);
  return Object.fromEntries(
    entries.filter(([, value]) => value !== ""),
  ) as Record<string, string>;
}
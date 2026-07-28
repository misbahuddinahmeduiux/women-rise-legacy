import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) { return <label className="field"><span>{label}</span><input {...props}/></label>; }
export function TextArea({ label, ...props }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) { return <label className="field"><span>{label}</span><textarea {...props}/></label>; }
export function Select({ label, children, ...props }: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) { return <label className="field"><span>{label}</span><select {...props}>{children}</select></label>; }
export function Checkbox({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) { return <label className="checkbox"><input type="checkbox" {...props}/><span>{label}</span></label>; }
export const FormInput = Field;
export const FormTextArea = TextArea;
export function FormSelect({ label, options, ...props }: { label: string; options: [string,string][] } & SelectHTMLAttributes<HTMLSelectElement>) { return <Select label={label} {...props}>{options.map(([value,text]: [string,string])=><option key={`${value}-${text}`} value={value}>{text}</option>)}</Select>; }

"use client";

/**
 * RegisterForm.tsx — Formulario de Registro de Usuario
 * Trazabilidad: TSK-I2-B11-F — Frontend Logic
 * 
 * Responsabilidades:
 * - Captura de datos (Email, Password, Birthdate, Terms).
 * - Validación robusta con Zod (Client-side).
 * - Feedback visual premium (Micro-interacciones).
 * - Integración con POST /api/v1/auth/register.
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { 
  Mail, 
  Lock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Info
} from 'lucide-react';
import { isOver18 } from '@/src/lib/services/age_validation';

// --- Schema de Validación (Sincronizado con RNF1, RNF3, RNF5) ---

const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres.')
  .max(128, 'Máximo 128 caracteres.')
  .regex(/[A-Z]/, 'Falta una mayúscula.')
  .regex(/[a-z]/, 'Falta una minúscula.')
  .regex(/[0-9]/, 'Falta un número.')
  .regex(/[\W_]/, 'Falta un carácter especial.');

const registerSchema = z.object({
  email: z.string().email('Introduce un email válido.'),
  password: passwordSchema,
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD.'),
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'Debes aceptar los términos.',
  }),
});

type RegisterFormData = z.infer<typeof registerSchema>;

// --- Estilos Base (Tailwind v4 classes + CSS variables) ---

const cardStyles: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-card)',
  padding: '2.5rem',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  maxWidth: '450px',
  width: '100%',
  backdropFilter: 'blur(10px)',
};

const inputContainerStyles: React.CSSProperties = {
  position: 'relative',
  marginBottom: '1.25rem',
};

const iconStyles: React.CSSProperties = {
  position: 'absolute',
  left: '1rem',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--color-text-muted)',
  transition: 'color 0.2s ease',
};

const inputStyles = "w-full pl-11 pr-4 py-3 bg-[#1f2937] border border-[#374151] rounded-lg text-white placeholder-[#6b7280] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all";

const labelStyles: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.025em',
};

const errorStyles: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-sla-critical)',
  marginTop: '0.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
};

// --- Componente Principal ---

export default function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const passwordValue = watch('password', '');
  const birthdateValue = watch('birthdate', '');

  // Validaciones en tiempo real fuera de zod para feedback dinámico
  const ageValidation = birthdateValue ? isOver18(birthdateValue) : null;

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // Re-validación de edad final
      if (!isOver18(data.birthdate)) {
        setServerError('Acceso denegado: Debes ser mayor de 18 años.');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        // Redirigir a página de espera (Verify Pending)
        router.push(`/auth/verify-pending?email=${encodeURIComponent(data.email)}`);
      } else {
        setServerError(result.message || 'Error inesperado en el servidor.');
      }
    } catch (err) {
      setServerError('No se pudo conectar con el servicio. Intenta más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={cardStyles}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-flex', 
          padding: '1rem', 
          borderRadius: '1rem', 
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          marginBottom: '1rem'
        }}>
          <ShieldCheck size={32} color="white" />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Crea tu Cuenta</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Únete a SimpleRegister y asegura tu identidad digital.
        </p>
      </header>

      {serverError && (
        <div style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid var(--color-sla-critical)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '0.75rem',
          color: 'var(--color-sla-critical)',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Email */}
        <div style={inputContainerStyles}>
          <label style={labelStyles}>Correo Electrónico</label>
          <Mail size={18} style={iconStyles} />
          <input
            {...register('email')}
            type="email"
            placeholder="ejemplo@correo.com"
            className={inputStyles}
          />
          {errors.email && (
            <span style={errorStyles}><AlertCircle size={14} /> {errors.email.message}</span>
          )}
        </div>

        {/* Password */}
        <div style={inputContainerStyles}>
          <label style={labelStyles}>Contraseña</label>
          <Lock size={18} style={iconStyles} />
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className={inputStyles}
          />
          {errors.password && (
            <span style={errorStyles}><AlertCircle size={14} /> {errors.password.message}</span>
          )}
        </div>

        {/* Birthdate */}
        <div style={inputContainerStyles}>
          <label style={labelStyles}>Fecha de Nacimiento</label>
          <Calendar size={18} style={iconStyles} />
          <input
            {...register('birthdate')}
            type="date"
            className={inputStyles}
          />
          {birthdateValue && (
            <div style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.7rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              color: ageValidation ? 'var(--color-sla-green)' : 'var(--color-sla-warning)'
            }}>
              {ageValidation ? <CheckCircle2 size={12} /> : <Info size={12} />}
              {ageValidation ? 'Edad válida (+18)' : 'Debes ser mayor de 18 años.'}
            </div>
          )}
          {errors.birthdate && (
            <span style={errorStyles}><AlertCircle size={14} /> {errors.birthdate.message}</span>
          )}
        </div>

        {/* Terms */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: 'var(--color-text-secondary)'
          }}>
            <input 
              type="checkbox" 
              {...register('terms_accepted')}
              style={{ width: '1.1rem', height: '1.1rem', accentColor: '#3b82f6' }}
            />
            <span>
              He leído y acepto la <a href="/policies/privacy" style={{ color: '#3b82f6', textDecoration: 'none' }}>Política de Privacidad</a> y los Términos de Uso.
            </span>
          </label>
          {errors.terms_accepted && (
            <span style={errorStyles}><AlertCircle size={14} /> {errors.terms_accepted.message}</span>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            backgroundColor: isLoading ? '#374151' : '#3b82f6',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.75rem',
            fontWeight: 600,
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'background-color 0.2s ease, transform 0.1s active',
          }}
        >
          {isLoading ? 'Registrando...' : 'Registrarse'}
          {!isLoading && <ArrowRight size={18} />}
        </button>
      </form>
      
      <footer style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          ¿Ya tienes cuenta? <a href="/auth/login" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Inicia Sesión</a>
        </p>
      </footer>
    </div>
  );
}

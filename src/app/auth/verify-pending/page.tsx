/**
 * page.tsx — Vista de Verificación Pendiente
 * Trazabilidad: TSK-I2-B11-F
 * 
 * Responsabilidad: Confirmar al usuario que su registro fue exitoso y 
 * guiarlo a su bandeja de entrada. Implementa el reenvío de email.
 */

"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, CheckCircle, RotateCw, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function VerifyPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'su correo electrónico';
  
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setResendStatus(null);
    
    try {
      const response = await fetch('/api/v1/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        setResendStatus({ type: 'success', message: '¡Email reenviado con éxito!' });
      } else {
        setResendStatus({ type: 'error', message: result.message || 'Error al reenviar.' });
      }
    } catch (err) {
      setResendStatus({ type: 'error', message: 'Error de conexión.' });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      padding: '3rem 2.5rem',
      maxWidth: '500px',
      width: '100%',
      textAlign: 'center',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        color: 'var(--color-sla-green)',
        marginBottom: '1.5rem',
      }}>
        <Mail size={32} />
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>¡Casi listo!</h1>
      
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
        Hemos enviado un enlace de activación al correo:<br />
        <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>
      </p>

      <div style={{
        backgroundColor: 'rgba(31, 41, 55, 0.5)',
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '2rem',
        textAlign: 'left',
        fontSize: '0.875rem',
      }}>
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} color="var(--color-sla-green)" /> Siguientes pasos:
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-text-secondary)', listStyleType: 'disc' }}>
          <li>Busca el correo en tu bandeja de entrada.</li>
          <li>Haz clic en el botón "Verificar Cuenta".</li>
          <li>Si no lo encuentras, revisa la carpeta de Spam.</li>
        </ul>
      </div>

      {resendStatus && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          backgroundColor: resendStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: resendStatus.type === 'success' ? 'var(--color-sla-green)' : 'var(--color-sla-critical)',
          border: `1px solid ${resendStatus.type === 'success' ? 'var(--color-sla-green)' : 'var(--color-sla-critical)'}`,
        }}>
          {resendStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {resendStatus.message}
        </div>
      )}

      <button
        onClick={handleResend}
        disabled={isResending}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.875rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border)',
          backgroundColor: 'transparent',
          color: 'var(--color-text-primary)',
          cursor: isResending ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          marginBottom: '1rem',
          transition: 'background-color 0.2s ease',
        }}
      >
        {isResending ? <RotateCw size={18} className="animate-spin" /> : <RotateCw size={18} />}
        {isResending ? 'Enviando...' : 'Reenviar código de verificación'}
      </button>

      <Link 
        href="/auth/register"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          textDecoration: 'none',
          transition: 'color 0.2s ease',
        }}
      >
        <ArrowLeft size={14} /> Volver al registro
      </Link>
    </div>
  );
}

export default function VerifyPendingPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'radial-gradient(circle at bottom right, #111827 0%, #0a0e1a 100%)',
    }}>
      <Suspense fallback={<div>Cargando...</div>}>
        <VerifyPendingContent />
      </Suspense>
    </main>
  );
}

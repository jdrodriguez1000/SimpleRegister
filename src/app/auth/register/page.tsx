/**
 * page.tsx — Vista de Registro de Usuario
 * Trazabilidad: TSK-I2-B11-F
 */

import React from 'react';
import RegisterForm from '@/src/app/components/auth/RegisterForm';

export const metadata = {
  title: 'Registro — SimpleRegister',
  description: 'Crea tu cuenta de forma segura y rápida en SimpleRegister.',
};

export default function RegisterPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'radial-gradient(circle at top left, #111827 0%, #0a0e1a 100%)',
    }}>
      <RegisterForm />
    </main>
  );
}

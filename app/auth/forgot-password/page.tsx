import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = {
  title: "Forgot Password - Spectra Fiber Portal",
  description: "Reset your Spectra subscriber portal account password.",
};

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

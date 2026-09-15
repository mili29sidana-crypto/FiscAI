import Link from "next/link";
 
export default function HomePage() {
  return (
    <>
      <h1>CA Tax OS — access foundation</h1>
      <p className="muted">
        Layer 1 of the AI execution layer for Indian CA firms: authentication, CA and firm
        verification, platform review, firm roles, and tenant isolation. A Chartered Accountant
        remains responsible for validation, approval, authentication, and filing.
      </p>
      <section className="card">
        <h2>Get started</h2>
        <p>
          <Link href="/register">Create an account</Link> or{" "}
          <Link href="/login">sign in</Link> to continue onboarding.
        </p>
      </section>
      <section className="card">
        <h2>Platform reviewers</h2>
        <p>
          <Link href="/platform/review">Open the verification queue</Link> to approve or reject
          firm and CA applications.
        </p>
      </section>
    </>
  );
}
"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  LockKey,
  ShieldCheck,
  Cpu,
  Code,
  Pulse,
  TerminalWindow,
  Check,
  Copy,
  ArrowSquareOut,
  CheckCircle,
  Skull,
  ChartLineUp,
} from "@phosphor-icons/react";
import { InterceptLogoMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

function CodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [code]);

  return (
    <div className="bezel-shell my-3">
      <div className="bezel-core overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-3.5 py-2 text-xs">
          <span className="font-mono font-medium text-foreground">{title}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="emil-press inline-flex items-center gap-1.5 rounded border border-border bg-white px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <span>{copied ? "Copied" : "Copy"}</span>
            <span className="t-icon-swap" data-state={copied ? "b" : "a"}>
              <span className="t-icon" data-icon="a">
                <Copy className="h-3 w-3" />
              </span>
              <span className="t-icon" data-icon="b">
                <Check className="h-3 w-3 text-zinc-950" weight="bold" />
              </span>
            </span>
          </button>
        </div>
        <pre className="p-3.5 font-mono text-xs text-foreground overflow-x-auto leading-relaxed bg-white">
          {code}
        </pre>
      </div>
    </div>
  );
}

const DOC_SECTIONS = [
  { id: "overview", num: "01", label: "Executive Overview", group: "Getting Started" },
  { id: "onboarding", num: "02", label: "User Onboarding & UX", group: "Getting Started" },
  { id: "verification", num: "03", label: "Security & Audit Verification", group: "Getting Started" },
  { id: "isolation", num: "04", label: "3-Domain Isolation Model", group: "Core Architecture" },
  { id: "tee-engine", num: "05", label: "Volatility-Aware TEE Engine", group: "Core Architecture" },
  { id: "guardrail", num: "06", label: "Rust Byte-Level Guardrail", group: "Core Architecture" },
  { id: "mpc-intents", num: "07", label: "Multi-Domain MPC & 1-Click", group: "Core Architecture" },
  { id: "redteam", num: "08", label: "11-Vector Red-Team Matrix", group: "Verification & Specs" },
  { id: "cli-reference", num: "09", label: "CLI & On-Chain Reference", group: "Verification & Specs" },
];

export default function InterceptDocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* Sticky Documentation Navbar */}
      <header className="sticky top-0 z-40 h-14 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-2xs">
                <InterceptLogoMark size={18} />
              </div>
              <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                Intercept
              </span>
            </Link>
            <span className="text-zinc-300">/</span>
            <Badge variant="secondary" className="font-mono">
              Documentation v1.0
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/eugenennamdi/Intercept"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              <span>GitHub</span>
              <ArrowSquareOut className="h-3.5 w-3.5" />
            </a>
            <Link href="/">
              <Button variant="default" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Live Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 3-Column Documentation Layout */}
      <div className="mx-auto flex w-full max-w-[1360px] flex-1 gap-10 px-4 py-8 sm:px-6">
        {/* Left Sticky Sidebar Navigation */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="sticky top-22 space-y-6">
            {["Getting Started", "Core Architecture", "Verification & Specs"].map(
              (group) => (
                <div key={group} className="space-y-1.5">
                  <div className="px-2.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </div>
                  <nav className="space-y-0.5">
                    {DOC_SECTIONS.filter((s) => s.group === group).map((s) => {
                      const active = activeSection === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => scrollTo(s.id)}
                          className={`emil-press flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs cursor-pointer ${
                            active
                              ? "bg-white font-semibold text-foreground shadow-2xs border border-border"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                          }`}
                        >
                          <span className="font-mono text-[10px] text-zinc-500">
                            {s.num}
                          </span>
                          <span className="truncate">{s.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              )
            )}
          </div>
        </aside>

        {/* Center Main Documentation Content */}
        <main className="flex-1 min-w-0 max-w-3xl space-y-12 pb-16">
          {/* 01. EXECUTIVE OVERVIEW */}
          <section id="overview" className="scroll-m-20 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-mono text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-zinc-900" />
              <span>INTERCEPT PROTOCOL SPECIFICATION · BUILT ON NEAR</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.035em] leading-[1.1] text-foreground">
              Non-Custodial Cross-Chain Liquidation Defense on NEAR
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-medium">Intercept</strong> is
              non-custodial cross-chain risk infrastructure built natively on{" "}
              <strong className="text-foreground font-medium">NEAR AI Cloud (TEE)</strong>,{" "}
              <strong className="text-foreground font-medium">
                NEAR Smart Contracts (near-sdk-rs)
              </strong>
              ,{" "}
              <strong className="text-foreground font-medium">
                NEAR Chain Signatures (v1.signer)
              </strong>
              , and{" "}
              <strong className="text-foreground font-medium">
                NEAR Intents 1-Click
              </strong>
              . It protects{" "}
              <strong className="text-foreground font-medium">
                Solana Kamino Lend
              </strong>{" "}
              borrowers from 5%–10% liquidation penalties using standby USDC held on{" "}
              <strong className="text-foreground font-medium">Base</strong>—without
              ever taking custody of the borrower’s Solana private key or permitting
              an off-chain agent to sign unverified transaction bytes.
            </p>

            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <Card>
                <CardHeader className="pb-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    SURVIVAL RATE
                  </span>
                  <CardTitle className="text-2xl tabular-nums">100%</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Across -34% violent flash crashes vs. 66.7% for static 1.20x bots.
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    CAPITAL SAVED
                  </span>
                  <CardTitle className="text-2xl tabular-nums">73.9%</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Less Base USDC deployed during calm mean-reverting pullbacks.
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    RED-TEAM SUITE
                  </span>
                  <CardTitle className="text-2xl tabular-nums">11 / 11</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Prompt-injection & gas-griefing exploits blocked in &lt;1.5 ms.
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 02. USER ONBOARDING & UX */}
          <section id="onboarding" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                02
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                How Real Users Onboard & Use Intercept
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Unlike traditional DeFi bots that require exporting private keys or
              approving unlimited token allowances, Intercept onboarding takes{" "}
              <strong className="text-foreground">three non-custodial steps</strong>{" "}
              via the{" "}
              <strong className="text-foreground">Configure Protection Policy</strong>{" "}
              modal on the dashboard:
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-white p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Step 1 — Connect or Paste Solana Position (Read-Only)
                  </span>
                  <Badge variant="outline">No Solana Signature Needed</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Click{" "}
                  <strong className="text-foreground">
                    Configure Protection Policy
                  </strong>{" "}
                  on the dashboard and either click{" "}
                  <strong className="text-foreground">Connect Phantom / Solflare</strong>{" "}
                  (read-only public key detection) or paste your Kamino Obligation Base58
                  address. Because Kamino Lend natively allows third-party debt repayment
                  (<code className="font-mono">repay_obligation_liquidity_v2</code>),
                  your Solana wallet never signs a delegation or shares a private key.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-white p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Step 2 — Lock Policy Bounds on NEAR (update_policy)
                  </span>
                  <Badge variant="secondary">guardrail.intercept-defi.near</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose your <strong className="text-foreground">Trigger Health Factor</strong>{" "}
                  (e.g. <code className="font-mono">1.15x</code> /{" "}
                  <code className="font-mono">11500 bps</code>),{" "}
                  <strong className="text-foreground">Max Per-Rescue USDC</strong>,{" "}
                  <strong className="text-foreground">Max Daily Limit USDC</strong>, and{" "}
                  <strong className="text-foreground">Max Bridge Slippage</strong>. Click{" "}
                  <strong className="text-foreground">
                    Save Protection Policy
                  </strong>{" "}
                  to immediately evaluate your rules against live telemetry in the
                  dashboard, or run the <code className="font-mono">near-cli-rs</code>{" "}
                  command below to commit them on-chain.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-white p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Step 3 — Fund Your Derived Base MPC Vault
                  </span>
                  <Badge variant="outline">Base Chain ID 8453</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Transfer idle USDC on Base to your deterministic{" "}
                  <code className="font-mono">v1.signer</code> Base MPC Vault (
                  <code className="font-mono">
                    0x72faa1abaf92e0c4b791f15acedb496c8979746c
                  </code>
                  ). Even <strong className="text-foreground">$1.00–$2.00 USDC</strong>{" "}
                  is sufficient to test a complete live cross-chain rescue.
                </p>
              </div>
            </div>
          </section>

          {/* 03. SECURITY & AUDIT VERIFICATION */}
          <section id="verification" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                03
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                End-to-End Security & Telemetry Verification
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Borrowers, risk teams, and security auditors can independently verify all
              four layers of Intercept (Live Mainnet Telemetry, NEAR AI Cloud TEE
              Reasoning, Deterministic Rust Byte Guardrails, and Quantitative Backtests)
              either in the browser or via the CLI verification suite:
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verification Action</TableHead>
                  <TableHead>Where to Test</TableHead>
                  <TableHead>What to Observe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    1. Live vs. Flash-Crash Simulation
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    Dashboard → Scenario Bar
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Toggle between <strong>Live Mainnet (0%)</strong> and{" "}
                    <strong>-25% Crash</strong>. Watch Health Factor recover from{" "}
                    <code className="font-mono">1.06 → 1.45</code> across the chart and
                    5-stage pipeline.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    2. Prompt-Injection Red-Team (11/11)
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    Dashboard → Security Tests Tab
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Click any of the 11 attack vectors (e.g. rogue ERC-20 destination,
                    Kamino borrow injection, 500 gwei gas drain) to inspect the exact Rust
                    contract panic.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    3. Raw EIP-1559 & Solana V0 Bytes
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    Dashboard → Cross-Chain Execution Tab
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Inspect the decoded RLP fields for <code className="font-mono">domain_id: 0</code>{" "}
                    and 539-byte Solana V0 instructions for <code className="font-mono">domain_id: 1</code>.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    4. Full CLI & Rust Test Suite
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    Terminal (<code className="font-mono">npm run verify</code>)
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Runs live <code className="font-mono">v1.signer</code> MPC derivation,
                    25 Rust unit &amp; adversarial tests, 11 Red-Team proofs, and 3-regime backtests.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          {/* 04. 3-DOMAIN ISOLATION MODEL */}
          <section id="isolation" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                04
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                3-Domain Non-Custodial Isolation Model
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              The foundational security invariant of Intercept is that{" "}
              <strong className="text-foreground">
                the AI agent never holds keys and never has a code path to user
                collateral
              </strong>
              :
            </p>

            <CodeBlock
              title="3-Domain Cryptographic Separation"
              code={`[Domain A: User Solana EOA]
  ├── Owns Kamino Obligation (SOL Collateral + USDC Debt)
  └── Private key NEVER shared with NEAR, MPC, or AI Agent

[Domain B: NEAR AI Cloud TEE + guardrail.intercept-defi.near]
  ├── TEE Enclave signs Ed25519 Rescue Receipt (observed_hf, volatility, quote)
  ├── Scoped NEAR FunctionCall Access Key (1.00 NEAR gas allowance, 0 NEAR attached deposit)
  │     ├── Permitted methods ONLY: request_rescue_origin_leg, request_rescue_destination_leg
  │     ├── Contract sponsors 0.05 NEAR v1.signer fee internally (reclaimed via refund)
  │     └── Forbidden: update_policy (Owner-only), TransferNEAR, DeployContract, AddKey
  └── Rust Guardrail parses every byte of Leg 1 & Leg 2 before calling v1.signer

[Domain C: v1.signer Chain Signatures + NEAR Intents 1-Click]
  ├── domain_id: 0 (Secp256k1) -> MPC_Base_Vault (0x72faa1abaf92e0c4b791f15acedb496c8979746c)
  └── domain_id: 1 (Ed25519)   -> MPC_Solana_Payer (GZMAbwapG99YKCsA2CDVc4bXeBzd7nvKMQgtm9K8aKas)`}
            />
          </section>

          {/* 05. VOLATILITY-AWARE TEE ENGINE */}
          <section id="tee-engine" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                05
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                Volatility-Aware TEE Risk Engine (NEAR AI Cloud)
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Executing inside{" "}
              <strong className="text-foreground">
                NEAR AI Cloud (deepseek-ai/DeepSeek-V3.1 on Intel TDX + NVIDIA Hopper)
              </strong>
              , the risk engine computes expected liquidation penalty versus cross-chain
              execution cost and selects one of three deterministic regimes:
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regime</TableHead>
                  <TableHead>Trigger Condition</TableHead>
                  <TableHead>Target Post-Rescue HF</TableHead>
                  <TableHead>Economic Rationale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs font-semibold">
                    HOLD
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    Observed HF &gt;= 1.1500
                  </TableCell>
                  <TableCell className="font-mono text-xs">No Action</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Preserves 100% of idle USDC yield on Base with 0 false triggers.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs font-semibold">
                    MICRO_BUFFER_RESCUE
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    HF &lt; 1.1500 · Calm Spread
                  </TableCell>
                  <TableCell className="font-mono text-xs">1.2000x</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Deploys minimal USDC during orderly dips, saving 73.9% capital vs.
                    static 1.45x bots.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs font-semibold">
                    CASCADE_DEEP_RESCUE
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    HF &lt; 1.1500 · High Vol / Spread
                  </TableCell>
                  <TableCell className="font-mono text-xs">1.4500x</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Builds a 31% liquidation buffer to survive violent multi-candle
                    flash crashes (-34%).
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          {/* 06. RUST BYTE-LEVEL GUARDRAIL */}
          <section id="guardrail" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                06
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                Deterministic Rust Byte-Level Guardrail Specification
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              The NEAR smart contract (<code className="font-mono">contracts/policy-guardrail/src/lib.rs</code>)
              never trusts a pre-computed hash from the AI agent. It requires the full
              raw unsigned transaction payload and enforces byte-offset invariants:
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Leg 1 — Base EIP-1559 RLP Verifier
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    request_rescue_origin_leg
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs space-y-1.5 text-muted-foreground">
                  <div>• Receipt <code className="font-mono text-foreground">observed_hf_bps &lt; min_trigger_hf_bps</code></div>
                  <div>• First byte must be <code className="font-mono text-foreground">0x02</code> &amp; <code className="font-mono text-foreground">chain_id == 8453</code></div>
                  <div>• <code className="font-mono text-foreground">max_priority_fee_per_gas &lt;= 10 gwei</code>, <code className="font-mono text-foreground">max_fee &lt;= 50 gwei</code></div>
                  <div>• <code className="font-mono text-foreground">to == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code></div>
                  <div>• <code className="font-mono text-foreground">value == 0</code> (Zero native ETH drain)</div>
                  <div>• Calldata <code className="font-mono text-foreground">[0..4] == 0xa9059cbb</code> (68 bytes, blocks <code className="font-mono text-foreground">approve</code>)</div>
                  <div>• Calldata <code className="font-mono text-foreground">[16..36] == 1-Click Deposit Address</code></div>
                  <div>• Calldata <code className="font-mono text-foreground">[52..68] == Receipt Amount &lt;= Per-Action &amp; 24h Cap</code></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Leg 2 — Solana V0 Kamino Verifier
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    request_rescue_destination_leg
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs space-y-1.5 text-muted-foreground">
                  <div>• Raw V0/Legacy message (<code className="font-mono text-foreground">64..=1232B</code>; live 5-ix V0 = <code className="font-mono text-foreground">539B</code>)</div>
                  <div>• Prefix <code className="font-mono text-foreground">0x80</code>, <code className="font-mono text-foreground">num_required_signatures == 1</code>, <code className="font-mono text-foreground">ALTs == 0</code></div>
                  <div>• ComputeBudget price <code className="font-mono text-foreground">&lt;= 5,000,000 micro-lamports</code></div>
                  <div>• Whitelisted Kamino <code className="font-mono text-foreground">KLend2g3...</code> refresh + 1 repay ix</div>
                  <div>• Discriminator <code className="font-mono text-foreground">0x74aed54cb435d290</code> (Repay v2)</div>
                  <div>• <code className="font-mono text-foreground">[0]</code> MPC Payer · <code className="font-mono text-foreground">[1]</code> Obligation · <code className="font-mono text-foreground">[2]</code> Main Market</div>
                  <div>• <code className="font-mono text-foreground">[3] == Pinned Mainnet USDC Reserve (D6q6wu...)</code></div>
                  <div>• <code className="font-mono text-foreground">[5] == Derived MPC Solana USDC ATA (2eLUYL...)</code></div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 07. MULTI-DOMAIN MPC & 1-CLICK */}
          <section id="mpc-intents" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                07
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                Multi-Domain v1.signer MPC & Async State Machine
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Because NEAR cross-contract calls to <code className="font-mono">v1.signer</code>{" "}
              execute asynchronously across blocks, Intercept enforces a strict 4-state
              per-receipt lifecycle (<code className="font-mono">InFlightLeg1</code> →{" "}
              <code className="font-mono">ReadyForLeg2</code> →{" "}
              <code className="font-mono">InFlightLeg2</code> →{" "}
              <code className="font-mono">Completed</code>) with non-panicking{" "}
              <code className="font-mono">#[private]</code> callbacks (
              <code className="font-mono">on_origin_leg_signed</code>,{" "}
              <code className="font-mono">on_destination_leg_signed</code>) that atomically
              roll back <code className="font-mono">rolling_24h_spent_usdc</code> if Leg 1
              MPC signing fails, or revert to <code className="font-mono">ReadyForLeg2</code>{" "}
              for safe retry if Leg 2 signing fails.
            </p>
          </section>

          {/* 08. 11-VECTOR RED-TEAM MATRIX */}
          <section id="redteam" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                08
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                11-Vector Adversarial Red-Team Verification Matrix
              </h2>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Exploit Vector</TableHead>
                  <TableHead>Target Layer</TableHead>
                  <TableHead>Guardrail Enforcement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["01", "Unauthorized Kamino Collateral Withdrawal", "Leg 2 · Solana V0", "Discriminator != Repay v2/v1 -> Revert"],
                  ["02", "Base USDC Recipient Redirection", "Leg 1 · Base EVM", "Calldata [16..36] != 1-Click Deposit -> Revert"],
                  ["03", "ERC-20 Unlimited Approval Injection", "Leg 1 · Base EVM", "Selector != 0xa9059cbb -> Revert"],
                  ["04", "Unauthorized Kamino Debt Drawdown", "Leg 2 · Solana V0", "Borrow Discriminator Blocked -> Revert"],
                  ["05", "Kamino Obligation Account Substitution", "Leg 2 · Solana V0", "Account [1] != User Obligation -> Revert"],
                  ["06", "Forged Enclave Attestation Signature", "TEE Attestation", "Ed25519 Verify / Nonce Replay -> Revert"],
                  ["07", "Solana V0 Address Lookup Table Obfuscation", "Leg 2 · Solana V0", "address_table_lookups_len != 0 -> Revert"],
                  ["08", "Blind 32-Byte Digest Signing Attempt", "Leg 2 · Solana V0", "Length < 64 bytes -> Revert"],
                  ["09", "Asynchronous Cross-Contract State Race", "Async TOCTOU State", "State != ReadyForLeg2 -> Revert"],
                  ["10", "Base EIP-1559 Gas-Fee Siphoning", "Leg 1 · Base EVM", "max_fee_per_gas > 50 gwei -> Revert"],
                  ["11", "Solana Compute-Budget Fee Siphoning", "Leg 2 · Solana V0", "SetComputeUnitPrice > 5M -> Revert"],
                ].map(([num, title, layer, rule]) => (
                  <TableRow key={num}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {num}
                    </TableCell>
                    <TableCell className="font-medium text-xs">{title}</TableCell>
                    <TableCell className="font-mono text-xs">{layer}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-800">
                      {rule}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {/* 09. CLI & ON-CHAIN REFERENCE */}
          <section id="cli-reference" className="scroll-m-20 space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
                09
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                CLI Verification & On-Chain Deployment Reference
              </h2>
            </div>

            <CodeBlock
              title="1. Run Deterministic 5-Step Mainnet Verifier & Backtest Suite"
              code={`npm run verify`}
            />

            <CodeBlock
              title="2. Run 25 Rust Guardrail Smart Contract Unit & Red-Team Tests"
              code={`cargo test --manifest-path contracts/policy-guardrail/Cargo.toml`}
            />

            <CodeBlock
              title="3. Configure Policy On-Chain (update_policy)"
              code={`near contract call-function as-transaction intercept-guardrail-373299.testnet update_policy json-args '{"new_policy":{"owner_id":"intercept-guardrail-373299.testnet","authorized_agent_id":"runner.intercept-guardrail-373299.testnet","mpc_signer_contract":"v1.signer-prod.testnet","tee_enclave_pubkey_hex":"c6424a09b326739f595a362ade4ed41a16ac39908f02a4e6c60b598653574f05","mpc_base_vault_address_hex":"0xfa1d66b9f3ae95f9d21b8db2315720c2fcde5320","mpc_solana_payer_pubkey":"7AqKFEDJ13ZxpnQnBEEM6XmGq2LNa65jXBE4q96emvCo","user_kamino_obligation_pubkey":"C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq","kamino_lending_market_pubkey":"7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF","sol_collateral_reserve_pubkey":"d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q","usdc_repay_reserve_pubkey":"D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59","base_derivation_path":"intercept-base-vault-1","solana_derivation_path":"intercept-solana-payer-1","max_per_action_usdc":"2500000000","max_daily_usdc":"5000000000","max_slippage_bps":100,"min_trigger_hf_bps":11500,"max_receipt_age_sec":300}}' prepaid-gas '80.0 Tgas' attached-deposit '0 NEAR' sign-as intercept-guardrail-373299.testnet network-config testnet sign-with-keychain send`}
            />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>On-Chain Step</TableHead>
                  <TableHead>Contract / Method</TableHead>
                  <TableHead>Transaction Hash (NearBlocks)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium">Contract Deploy &amp; Init</TableCell>
                  <TableCell className="font-mono text-xs">intercept-guardrail-373299.testnet::new</TableCell>
                  <TableCell className="font-mono text-xs">
                    <a
                      href="https://testnet.nearblocks.io/txns/FHbKGEa9q2h3Pu4adQpyVhSHVAfiPZSFQTk9DNCb6ns9"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-zinc-600"
                    >
                      FHbKGEa9q2h3Pu4adQpyVhSHVAfiPZSFQTk9DNCb6ns9
                    </a>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">WASM Upgrade &amp; Owner Policy Update</TableCell>
                  <TableCell className="font-mono text-xs">DeployContract + update_policy</TableCell>
                  <TableCell className="font-mono text-xs">
                    <a
                      href="https://testnet.nearblocks.io/txns/AtGgegrK4nGFX7Lksu66zSBvgGoqP8Wr7jAQepfaW3Bf"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-zinc-600"
                    >
                      AtGgegrK4nGFX7Lksu66zSBvgGoqP8Wr7jAQepfaW3Bf
                    </a>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">Scoped FunctionCall Key Provisioning</TableCell>
                  <TableCell className="font-mono text-xs">runner.intercept-guardrail-373299.testnet (AddKey)</TableCell>
                  <TableCell className="font-mono text-xs">
                    <a
                      href="https://testnet.nearblocks.io/txns/3TFzFZ6vF1uEYBEPtvf8X5PDiWo3VKZojJSMzuiKriVF"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-zinc-600"
                    >
                      3TFzFZ6vF1uEYBEPtvf8X5PDiWo3VKZojJSMzuiKriVF
                    </a>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">Leg 1 Zero-Deposit FunctionCall Rescue (Secp256k1)</TableCell>
                  <TableCell className="font-mono text-xs">request_rescue_origin_leg → v1.signer-prod.testnet</TableCell>
                  <TableCell className="font-mono text-xs">
                    <a
                      href="https://testnet.nearblocks.io/txns/5GZMVE9fokSqLqNNxZTLZEzeHrBbkQSAfLro5NMeZFJt"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-zinc-600"
                    >
                      5GZMVE9fokSqLqNNxZTLZEzeHrBbkQSAfLro5NMeZFJt
                    </a>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">Leg 2 Zero-Deposit FunctionCall Repay (Ed25519)</TableCell>
                  <TableCell className="font-mono text-xs">request_rescue_destination_leg → v1.signer-prod.testnet</TableCell>
                  <TableCell className="font-mono text-xs">
                    <a
                      href="https://testnet.nearblocks.io/txns/9mHD6Qp7tCeaMieWyLTYb7wE3YyHRR3BmtqcdzG2xeFr"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-zinc-600"
                    >
                      9mHD6Qp7tCeaMieWyLTYb7wE3YyHRR3BmtqcdzG2xeFr
                    </a>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">On-Chain Healthy-Position Block (HF &gt;= Trigger)</TableCell>
                  <TableCell className="font-mono text-xs">PositionHealthyAboveTrigger Revert</TableCell>
                  <TableCell className="font-mono text-xs">
                    <a
                      href="https://testnet.nearblocks.io/txns/i1YgQ5EMZ78FWUoD8kZFKyqpADY6RNo6kKNYTCKrudJ"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-zinc-600"
                    >
                      i1YgQ5EMZ78FWUoD8kZFKyqpADY6RNo6kKNYTCKrudJ
                    </a>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">Async TOCTOU Failure Rollback</TableCell>
                  <TableCell className="font-mono text-xs">on_origin_leg_signed (rescue_origin_leg_rolled_back)</TableCell>
                  <TableCell className="font-mono text-xs">
                    <a
                      href="https://testnet.nearblocks.io/txns/GnXXpAsFo6w9c77SjkK8VNYvY3uAwY49rPdFPbnzhvkk"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-zinc-600"
                    >
                      GnXXpAsFo6w9c77SjkK8VNYvY3uAwY49rPdFPbnzhvkk
                    </a>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>
        </main>

        {/* Right Sticky Table of Contents & Live Contract Card */}
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-22 space-y-4">
            <div className="rounded-xl border border-border bg-white p-4 space-y-3 text-xs">
              <div className="font-semibold text-foreground">
                Verified NEAR Testnet
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">
                  GUARDRAIL CONTRACT
                </div>
                <a
                  href="https://testnet.nearblocks.io/address/intercept-guardrail-373299.testnet"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-foreground break-all underline underline-offset-4 hover:text-zinc-600 block"
                >
                  intercept-guardrail-373299.testnet
                </a>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">
                  SCOPED AGENT KEY
                </div>
                <a
                  href="https://testnet.nearblocks.io/address/runner.intercept-guardrail-373299.testnet"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-foreground break-all underline underline-offset-4 hover:text-zinc-600 block"
                >
                  runner.intercept-guardrail-373299.testnet
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-4 space-y-3 text-xs">
              <div className="font-semibold text-foreground">
                Mainnet Architecture
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">
                  NEAR GUARDRAIL
                </div>
                <div className="font-mono text-foreground break-all">
                  guardrail.intercept-defi.near
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">
                  MPC SIGNER
                </div>
                <div className="font-mono text-foreground">v1.signer</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">
                  DERIVED BASE VAULT (0)
                </div>
                <div className="font-mono text-foreground break-all">
                  0x72faa1abaf92e0c4b791f15acedb496c8979746c
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">
                  DERIVED SOLANA PAYER (1)
                </div>
                <div className="font-mono text-foreground break-all">
                  GZMAbwapG99YKCsA2CDVc4bXeBzd7nvKMQgtm9K8aKas
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

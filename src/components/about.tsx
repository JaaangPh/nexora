import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Activity,
  CircleDollarSign,
  FileText,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { RUNNER_CATALOG } from './market';

const sections = [
  { id: 'abstract', label: 'About this whitepaper' },
  { id: 'protocol', label: 'Product & access' },
  { id: 'runners', label: 'Runner marketplace' },
  { id: 'rewards', label: 'Balance & reward model' },
  { id: 'workout', label: 'Activity tracking' },
  { id: 'account', label: 'Accounts & platform' },
  { id: 'limitations', label: 'Current limitations' },
] as const;

const peso = (amount: number) => `₱${amount.toFixed(2)}`;

export const AboutWhitepaper: React.FC = () => {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('abstract');
  const walker = RUNNER_CATALOG.find((runner) => runner.id === 'snk-1')!;
  const trainer = RUNNER_CATALOG.find((runner) => runner.id === 'snk-2')!;
  const sampleDistances = [1, 6, 10, 16];
  const matchingSections = sections.filter((section) => section.label.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visibleSection = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

      if (visibleSection) setActiveSection(visibleSection.target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });

    sections.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const renderSectionLinks = (onSelect?: () => void) => sections.map((section) => (
    <a
      key={section.id}
      href={`#${section.id}`}
      onClick={() => {
        setActiveSection(section.id);
        onSelect?.();
      }}
      aria-current={activeSection === section.id ? 'location' : undefined}
      className={`group block border-l-2 py-2 pl-3 text-[13px] no-underline transition-colors ${
        activeSection === section.id
          ? 'border-cyan-600 font-semibold text-cyan-800'
          : 'border-transparent text-slate-600 hover:text-cyan-800'
      }`}
    >
      {section.label}
    </a>
  ));

  const renderSearchResults = () => searchQuery.trim() ? (
    <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
      {matchingSections.length ? matchingSections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          onClick={() => {
            setActiveSection(section.id);
            setSearchQuery('');
            setIsMobileSearchOpen(false);
          }}
          className="block rounded-md px-3 py-2 text-sm text-slate-700 no-underline hover:bg-cyan-50 hover:text-cyan-900"
        >
          {section.label}
        </a>
      )) : <p className="px-3 py-2 text-sm text-slate-500">No matching sections</p>}
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-white text-[#263746] selection:bg-cyan-100 selection:text-[#102A43]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1560px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Open documentation navigation"
            onClick={() => setIsNavigationOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <a href="/" className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-slate-900 no-underline">
            <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-md" />
            <span className="truncate">Nexora <span className="font-normal text-slate-400">/</span> Whitepaper</span>
          </a>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="relative hidden sm:block">
              <label htmlFor="whitepaper-search" className="sr-only">Search the whitepaper</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="whitepaper-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search this whitepaper..."
                className="h-10 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 lg:w-72"
              />
              {renderSearchResults()}
            </div>
            <button
              type="button"
              aria-label={isMobileSearchOpen ? 'Close whitepaper search' : 'Search the whitepaper'}
              aria-expanded={isMobileSearchOpen}
              onClick={() => {
                setIsMobileSearchOpen((open) => !open);
                setSearchQuery('');
              }}
              className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100 sm:hidden"
            >
              {isMobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <a href="/" aria-label="Back to Nexora" className="flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold text-slate-600 no-underline hover:bg-slate-100 hover:text-slate-900 sm:px-3">
              <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back to app</span>
            </a>
          </div>
        </div>
        {isMobileSearchOpen && (
          <div className="border-t border-slate-200 px-4 py-3 sm:hidden">
            <div className="relative">
              <label htmlFor="whitepaper-search-mobile" className="sr-only">Search the whitepaper</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="whitepaper-search-mobile"
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search this whitepaper..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              {renderSearchResults()}
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto grid max-w-[1560px] lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_224px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto border-r border-slate-200 px-5 py-8 lg:block">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <BookOpen className="h-4 w-4" /> Documentation
          </div>
          <div className="mb-3 px-3 text-xs font-semibold text-slate-400">NEXORA PRODUCT GUIDE</div>
          <nav aria-label="Whitepaper sections">{renderSectionLinks()}</nav>
          <div className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">
            Product mechanics · v1.0<br />Updated October 2026
          </div>
        </aside>

        {isNavigationOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close documentation navigation"
              onClick={() => setIsNavigationOpen(false)}
              className="absolute inset-0 bg-slate-950/30"
            />
            <aside className="relative flex h-full w-[min(85vw,320px)] flex-col border-r border-slate-200 bg-white px-5 py-5 shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <a href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-900 no-underline">
                  <img src="/logo.png" alt="" className="h-8 w-8 rounded-md" /> Nexora Whitepaper
                </a>
                <button type="button" aria-label="Close navigation" onClick={() => setIsNavigationOpen(false)} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Documentation</div>
              <nav aria-label="Whitepaper sections" className="flex-1">{renderSectionLinks(() => setIsNavigationOpen(false))}</nav>
              <div className="border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">Product mechanics · v1.0<br />Updated October 2026</div>
            </aside>
          </div>
        )}

        <main className="min-w-0 px-5 pb-16 sm:px-8 lg:px-12 xl:px-16">
          <article className="mx-auto max-w-[780px]">
            <div className="pt-8 sm:pt-12">
              <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
                <a href="/" className="text-cyan-800 no-underline hover:underline">Nexora</a>
                <span>/</span><span>Product whitepaper</span>
              </div>
              <section id="abstract" className="scroll-mt-24 border-b border-slate-200 pb-8 sm:pb-10">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-800">
                  <FileText className="h-4 w-4" /> Product whitepaper <span className="text-slate-300">·</span> Reviewed 11 October 2026
                </div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[42px]">Stepora Movement: Product &amp; System Overview</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  A source-based guide to the app’s account flows, Runner catalog, movement tracker, balance controls, referral screens, and current implementation boundaries.
                </p>
                <div className="relative mt-7 overflow-hidden rounded-xl border border-[#1D5361] bg-[#071B2B] px-5 py-6 text-white sm:px-8 sm:py-8">
                  <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(87, 223, 210, .16) 1px, transparent 1px), linear-gradient(90deg, rgba(87, 223, 210, .16) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                  <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Nexora product model</p>
                        <p className="mt-1 text-xs text-slate-300">Account · Runner · Activity · In-app balance</p>
                      </div>
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-medium text-cyan-100">PRODUCT OVERVIEW</span>
                    </div>
                    <div className="mt-7 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-4">
                      <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 sm:p-4">
                        <Activity className="h-5 w-5 text-cyan-300" />
                        <p className="mt-3 text-xs font-semibold sm:text-sm">Move</p>
                        <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">GPS / motion estimate</p>
                      </div>
                      <span className="h-px w-full border-t border-dashed border-cyan-300/50" />
                      <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 sm:p-4">
                        <ShieldCheck className="h-5 w-5 text-teal-300" />
                        <p className="mt-3 text-xs font-semibold sm:text-sm">Measure</p>
                        <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Runner limits</p>
                      </div>
                      <span className="h-px w-full border-t border-dashed border-cyan-300/50" />
                      <div className="rounded-lg border border-cyan-200/20 bg-cyan-300/[0.08] p-3 sm:p-4">
                        <CircleDollarSign className="h-5 w-5 text-cyan-200" />
                        <p className="mt-3 text-xs font-semibold sm:text-sm">Settle</p>
                        <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">In-app PHP</p>
                      </div>
                    </div>
                    <div className="mt-5 border-t border-white/10 pt-3 text-[10px] text-slate-400">
                      The current app has no connected blockchain wallet, token contract, or live exchange.
                    </div>
                  </div>
                </div>
                <div className="mt-5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-950">
                  <strong>Important scope.</strong> Amounts shown as pesos are in-app account values. They are not proof of a deposit, withdrawable funds, a crypto asset, or guaranteed income. Deposit and withdrawal screens currently simulate the interaction; see <a href="#rewards" className="font-semibold text-amber-900 underline">Balance &amp; reward model</a> and <a href="#account" className="font-semibold text-amber-900 underline">referral limitations</a>.
                </div>
              </section>
            </div>

            <section id="protocol" className="scroll-mt-24 border-b border-slate-200 py-8 sm:py-10">
              <h2 className="text-2xl font-bold text-slate-900">Product &amp; access</h2>
              <p className="mt-4 leading-7 text-slate-600">After sign-in, the dashboard has five active areas: Home, Market, Track, Team, and Me. Home summarizes the balance and links to common actions. Market manages the Runner catalog; Track records sessions; Team exposes referral sharing and summary fields; Me manages profile settings, APK access, and sign-out.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ['Home', 'Shows the balance and total-deposit fields, quick-action shortcuts, and an equipped Runner card.'],
                  ['Market', 'Searches and filters the fixed Runner catalog; members can inspect, purchase, and equip items.'],
                  ['Track', 'Selects available owned Runners, captures a session, and displays the calculated reward before collection.'],
                  ['Team', 'Copies a referral code or link, shows the direct referral count and earned referral rewards, and retains Team Volume as a placeholder.'],
                  ['Me', 'Shows the account balance and deposit total, and provides quick actions for Team Marathon, My Runners, Bank Account, Customer Service, My Records, and Download App. Profile details, username editing, Nexora ID copying, and sign-out remain available below.'],
                  ['Support', 'Dashboard shortcuts open the official Stepora Telegram support and Facebook page.'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 leading-7 text-slate-600">Registration asks for a phone number, password, confirmation, and invite-code field. The interface checks for a 7–15 digit phone number and a matching password of at least six characters. The API hashes passwords with bcrypt, stores account data in Firebase Cloud Firestore, and issues a signed session token. Protected API calls check that the token belongs to the account’s current active session; signing in again replaces the previous session.</p>
              <p className="mt-3 leading-7 text-slate-600">The referral code is optional during registration. When one is provided, the server verifies that it belongs to an existing member before creating the account; leaving it blank creates an account without a referrer. Some legacy files mention charts and trading, but those are not active dashboard workflows.</p>
            </section>

            <section id="runners" className="scroll-mt-24 border-b border-slate-200 py-8 sm:py-10">
              <h2 className="text-2xl font-bold text-slate-900">Runner assets</h2>
              <p className="mt-3 leading-7 text-slate-600">The current Marketplace catalog defines each Runner’s listed rate, daily kilometer allowance, and purchase price.</p>
              <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
                {RUNNER_CATALOG.map((runner) => (
                  <div key={runner.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[64px_minmax(0,1fr)_repeat(3,auto)] sm:gap-5">
                    <img src={runner.image} alt={`${runner.name} Runner`} className="h-12 w-12 rounded-md border border-slate-200 bg-white object-contain p-1 sm:h-14 sm:w-14" />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-slate-900">{runner.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{runner.category} · {runner.speedRange} · Comfort {runner.comfort}/10</p>
                    </div>
                    <div className="text-right sm:text-left"><span className="block text-[10px] text-slate-500">RATE</span><span className="font-mono text-xs font-semibold text-cyan-900">{peso(runner.earningRate)}/km</span></div>
                    <div className="hidden text-left sm:block"><span className="block text-[10px] text-slate-500">DAILY LIMIT</span><span className="font-mono text-xs text-slate-700">{runner.kmLimitPerDay} km</span></div>
                    <div className="hidden text-left sm:block"><span className="block text-[10px] text-slate-500">PRICE</span><span className="font-mono text-xs text-slate-700">₱{runner.pricePhp.toLocaleString('en-US')}</span></div>
                    <div className="col-start-2 text-[11px] text-slate-500 sm:hidden">Limit {runner.kmLimitPerDay} km · ₱{runner.pricePhp.toLocaleString('en-US')}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Each Marketplace purchase creates a separate Runner in My Runners with its own four-digit serial number, even when buying the same model more than once. Track lists the account’s individual Runner copies and applies workout cooldowns to the selected copies. Speed range, comfort, and health/resilience are catalog attributes; the reward calculation uses the listed rate and kilometer limit.</p>
            </section>

            <section id="rewards" className="scroll-mt-24 border-b border-slate-200 py-8 sm:py-10">
              <h2 className="text-2xl font-bold text-slate-900">Balance &amp; reward model</h2>
              <p className="mt-4 leading-7 text-slate-600">
                A selected Runner’s limit contributes to the combined session distance ceiling. For the measured session distance, the app sums each Runner’s listed rate multiplied by the lesser of that distance or the Runner’s individual daily limit.
              </p>
              <div className="my-5 overflow-x-auto rounded-md bg-[#18212B] px-4 py-4 font-mono text-xs leading-6 text-slate-100 sm:px-5 sm:text-sm">
                Session ceiling = sum of selected Runners’ daily limits<br />
                Displayed reward = sum of [min(session km, Runner limit) × listed rate]
              </div>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[470px] border-collapse text-left text-sm">
                  <thead><tr className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">Accepted distance</th><th className="px-4 py-3">Walker contribution</th><th className="px-4 py-3">Trainer contribution</th><th className="px-4 py-3">Total</th></tr></thead>
                  <tbody>{sampleDistances.map((distance) => {
                    const walkerReward = Math.min(distance, walker.kmLimitPerDay) * walker.earningRate;
                    const trainerReward = Math.min(distance, trainer.kmLimitPerDay) * trainer.earningRate;
                    return <tr key={distance} className="border-t border-slate-200 text-slate-700"><td className="px-4 py-3">{distance} km</td><td className="px-4 py-3 font-mono">{peso(walkerReward)}</td><td className="px-4 py-3 font-mono">{peso(trainerReward)}</td><td className="px-4 py-3 font-mono font-bold text-slate-900">{peso(walkerReward + trainerReward)}</td></tr>;
                  })}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">For the first two catalog Runners, this formula yields ₱18.60 at 1 km and ₱152.40 at their combined 16 km ceiling. These are client-side calculations, not promised payouts.</p>
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-sm leading-6 text-red-950">
                <strong>Deposit and withdrawal are not payment integrations.</strong> Deposit currently simulates a delay and increases the displayed balance without charging the selected payment method. Withdrawal checks the entered amount against the displayed balance and shows a success message, but sends no payout request and does not submit account details. The balance API stores a value; it is not a payment processor or transaction ledger.
              </div>
            </section>

            <section id="workout" className="scroll-mt-24 border-b border-slate-200 py-8 sm:py-10">
              <h2 className="text-2xl font-bold text-slate-900">Activity tracking</h2>
              <p className="mt-4 leading-7 text-slate-600">Track requires at least one owned Runner that is not cooling down. Members can select multiple available Runners, choose a displayed activity mode, start, pause/resume, and review a summary before collecting. GPS positions are shown on the map and accepted route points are drawn as a path.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Distance and estimates</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">GPS distance is accumulated between accepted location fixes using a coordinate-distance calculation and basic accuracy/movement filters. The motion fallback estimates distance from device-motion step events at about 0.74 metres per detected step. When both are available, the app uses the larger step estimate; it does not independently verify a route.</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Session handling</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Workout progress is saved locally and synced to the signed-in account, allowing it to be restored on another device. A workout restored on a new device is paused and must be resumed manually. Pausing freezes time, steps, calories, and the displayed reward estimate. Losing internet pauses the workout until the user reconnects and taps Resume. A new sign-in on another device invalidates the previous session, which pauses the workout on that device. Confirming End &amp; Earn stops the workout and submits its reward for validation; reaching the combined distance limit also ends it automatically. Each selected Runner then receives a 12-hour cooldown.</p>
                </div>
              </div>
              <p className="mt-4 leading-7 text-slate-600">Running, cycling, and transit are selectable in the interface, but the current reward formula does not vary by mode. GPS availability, motion sensors, background operation, permissions, and connection quality depend on the device and browser.</p>
              <ol className="mt-5 list-inside list-decimal space-y-3 pl-1 text-sm leading-6 text-slate-600 marker:font-mono marker:text-cyan-800">
                <li>Purchase and own one or more catalog Runners; select those that are not cooling down.</li>
                <li>Start a session using GPS or the motion-sensor fallback, then pause or resume as needed.</li>
                <li>End the session to review the locally calculated distance, elapsed time, estimated calories, and reward.</li>
                <li>Cancel &amp; Continue resumes the session. Collect &amp; Continue records the selected Runner cooldowns; the displayed reward estimate is not credited.</li>
              </ol>
            </section>

            <section id="account" className="scroll-mt-24 border-b border-slate-200 py-8 sm:py-10">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-800" /><h2 className="text-2xl font-bold text-slate-900">Account security</h2></div>
              <p className="mt-4 leading-7 text-slate-600">Firestore account records include profile fields, password hash, role/status, referral fields, balance, Runner ownership/equipment, and cooldowns. Passwords are hashed with bcrypt. The Express API issues signed session tokens and protected requests check the account’s active session; signing in again replaces the previous session. Login and registration attempts are limited to 30 per IP per 15-minute window. Balance changes from deposits are applied only by the signed TurboPay callback, and the former client balance-update endpoint is disabled.</p>
              <h3 id="referrals" className="mt-6 scroll-mt-24 text-sm font-semibold text-slate-900">Referral and team screen</h3>
              <p className="mt-2 leading-7 text-slate-600">Each account receives a generated referral code and the Team screen creates a shareable code/link. When a referred member buys their first Runner, their direct referrer receives ₱100 and the next two ancestors in the referral chain each receive ₱50. No more distant ancestor is paid for that purchase. The reward is calculated separately for each referred member, and later Runner purchases by the same member do not pay again. For example, when Gerald buys his first Runner after being invited by Julia, who was invited by Joshua, Gerald's purchase pays Julia ₱100, Joshua ₱50, and the next eligible ancestor ₱50. Direct Team and earned Referral Reward are shown in the Team screen; Team Volume remains a placeholder.</p>
              <h3 className="mt-6 text-sm font-semibold text-slate-900">Application and persistence</h3>
              <p className="mt-2 leading-7 text-slate-600">The client is a React/TypeScript app built with Vite and packaged for Android using Capacitor. The Express server exposes authentication/account and TurboPay deposit routes backed by Firebase Admin and Cloud Firestore. Deposit orders are stored in Firestore and credited once after a valid provider signature, matching order, and exact amount are checked. Session/profile data and workout snapshots are stored in browser/device local storage. Withdrawal and workout reward payouts are not currently integrated.</p>
            </section>

            <section id="limitations" className="scroll-mt-24 py-8 sm:py-10">
              <h2 className="text-2xl font-bold text-slate-900">Current limitations</h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-600 marker:text-cyan-800">
                <li>GPS and step-derived distance, steps, and calories are device estimates that can be inaccurate. Basic movement filters are not comprehensive fraud prevention; driving, spoofing, repeated routes, and sensor manipulation are not reliably identified.</li>
                <li>Workout rewards are locally estimated and are not credited while server-authoritative reward validation is unavailable. GPS and motion signals are not independently verified.</li>
                <li>TurboPay deposits require deployment-time merchant credentials and public HTTPS callback/return URLs. Withdrawals, on-chain tokens, smart contracts, connected wallets, and exchange integrations are not implemented.</li>
                <li>Catalog prices, listed rates, support availability, and future product terms are not guarantees. Consult the live app and applicable official terms.</li>
              </ul>
            </section>

            <footer className="border-t border-slate-200 py-6 text-xs text-slate-500">
              Stepora Movement · Product whitepaper · Source-based description · Reviewed 11 October 2026
            </footer>
          </article>
        </main>

        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto px-5 py-8 xl:block">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">On this page</p>
          <nav aria-label="On this page">{renderSectionLinks()}</nav>
        </aside>
      </div>
    </div>
  );
};

export default AboutWhitepaper;

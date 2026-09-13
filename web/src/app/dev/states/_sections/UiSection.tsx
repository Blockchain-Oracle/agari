"use client";

import { SectionHeader } from "@/components/chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/lib/toast";
import { Fixture, FixtureGrid } from "./Fixture";

const CADENCES = ["60s", "5m", "15m", "1h"] as const;

export function UiSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="06" title="Primitives" eyebrow="shadcn on Base UI, skinned by the tokens" />
      <FixtureGrid>
        <Fixture label="Buttons — primary vermilion, secondary, outline, ghost, destructive = warning ink">
          <div className="flex flex-wrap gap-2">
            <Button>Place bet</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Revoke</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="w-full">
              CTA at ticket height
            </Button>
          </div>
        </Fixture>
        <Fixture label="Input — ground well, hairline, vermilion focus ring">
          <Input type="text" inputMode="decimal" placeholder="0.00" className="type-data-lg" aria-label="Stake" />
        </Fixture>
        <Fixture label="Badges + switch">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Founder</Badge>
            <Badge variant="secondary">14 settled</Badge>
            <Badge variant="outline">HOUSE</Badge>
            <Separator orientation="vertical" className="h-5" />
            <Switch defaultChecked aria-label="Sound" />
          </div>
        </Fixture>
        <Fixture label="Tabs — cadence lanes">
          <Tabs defaultValue="5m">
            <TabsList variant="line">
              {CADENCES.map((c) => (
                <TabsTrigger key={c} value={c} className="min-h-touch numbers">
                  {c}
                </TabsTrigger>
              ))}
            </TabsList>
            {CADENCES.map((c) => (
              <TabsContent key={c} value={c} className="type-body text-ink-secondary">
                {c} lane
              </TabsContent>
            ))}
          </Tabs>
        </Fixture>
        <Fixture label="Tooltip, sheet, toasts">
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger render={<Button variant="secondary" />}>Hover me</TooltipTrigger>
              <TooltipContent>Every proof link is one tap from its tx.</TooltipContent>
            </Tooltip>
            <Sheet>
              <SheetTrigger render={<Button variant="secondary" />}>Bottom sheet</SheetTrigger>
              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>Ticket sheet</SheetTitle>
                  <SheetDescription>Top corners rounded, safe-area padded, scrim behind.</SheetDescription>
                </SheetHeader>
                <div className="p-4 type-body text-ink-secondary">The Ticket lives here below lg.</div>
              </SheetContent>
            </Sheet>
            <Button variant="secondary" onClick={() => notify.neutral("Copied")}>
              Neutral toast
            </Button>
            <Button variant="secondary" onClick={() => notify.warning("Quote is 14s old — requoting")}>
              Warning toast
            </Button>
          </div>
        </Fixture>
      </FixtureGrid>
    </section>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function ComingSoon({ title, phase, desc }: { title: string; phase: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">{title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{desc}</p>
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-3">
            <Construction className="h-6 w-6" />
          </div>
          <div className="text-lg font-medium">Coming in {phase}</div>
          <div className="text-sm text-muted-foreground mt-1 max-w-md">
            This module is part of a future phase. The foundation is in place — feature work begins soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

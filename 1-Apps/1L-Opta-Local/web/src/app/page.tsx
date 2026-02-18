"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@opta/ui";
import { Button } from "@opta/ui";
import { Badge } from "@opta/ui";
import { Wifi, WifiOff, Server } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card variant="glass" className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">
              Opta Local
            </CardTitle>
            <Badge variant="default" size="sm">
              <WifiOff className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          </div>
          <CardDescription>
            Chat with your local AI from anywhere
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="glass-subtle rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-neon-cyan" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Mac Studio M3 Ultra
                  </p>
                  <p className="text-xs text-text-secondary">
                    192.168.188.11 &mdash; 512GB RAM
                  </p>
                </div>
              </div>
            </div>
            <div className="glass-subtle rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-neon-green" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Connection
                  </p>
                  <p className="text-xs text-text-secondary">
                    LAN &bull; Direct connection
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="primary" size="lg" className="w-full">
            Connect to Server
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

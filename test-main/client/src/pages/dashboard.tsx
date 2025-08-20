import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Bot, Users, TrendingUp, Activity } from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  totalVolume: string;
  recentTransactions: Array<{
    id: string;
    type: string;
    tokenSymbol: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-300 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-300 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6" data-testid="dashboard-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="h-8 w-8 text-blue-600" data-testid="bot-icon" />
            <h1 className="text-3xl font-bold text-gray-900" data-testid="dashboard-title">
              FREE Solana Trading Bot
            </h1>
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              100% FREE
            </div>
          </div>
          <p className="text-gray-600" data-testid="dashboard-subtitle">
            Monitor your completely free Telegram bot's performance - no hidden costs!
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stats-total-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-users-count">
                {stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Registered bot users
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stats-active-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="active-users-count">
                {stats?.activeUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Users with wallets connected
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stats-total-transactions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-transactions-count">
                {stats?.totalTransactions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Completed trades
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stats-total-volume">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-volume-amount">
                {stats?.totalVolume || "0"} SOL
              </div>
              <p className="text-xs text-muted-foreground">
                Trading volume
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card data-testid="recent-transactions-card">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.recentTransactions?.length ? (
              <div className="text-center py-8 text-gray-500" data-testid="no-transactions">
                No transactions yet. Transactions will appear here once users start trading.
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white"
                    data-testid={`transaction-${tx.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={tx.type === "buy" ? "default" : "secondary"}
                        data-testid={`transaction-type-${tx.id}`}
                      >
                        {tx.type.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="font-medium" data-testid={`transaction-symbol-${tx.id}`}>
                          {tx.tokenSymbol}
                        </p>
                        <p className="text-sm text-gray-500" data-testid={`transaction-amount-${tx.id}`}>
                          {tx.amount}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          tx.status === "confirmed"
                            ? "default"
                            : tx.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        data-testid={`transaction-status-${tx.id}`}
                      >
                        {tx.status}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1" data-testid={`transaction-date-${tx.id}`}>
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bot Status */}
        <Card className="mt-6" data-testid="bot-status-card">
          <CardHeader>
            <CardTitle>Bot Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" data-testid="bot-status-indicator"></div>
                <span className="font-medium" data-testid="bot-status-text">Dashboard Active</span>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open("https://core.telegram.org/bots#6-botfather", "_blank")}
                data-testid="button-create-bot"
              >
                Create FREE Bot
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-2" data-testid="bot-description">
              <strong>100% FREE Setup:</strong> Create a Telegram bot with @BotFather, add the token to start trading. No costs involved!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

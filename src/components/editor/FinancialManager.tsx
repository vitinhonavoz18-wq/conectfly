import React, { useMemo, useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Calendar,
  CreditCard,
  Wallet,
  Coins,
  ArrowRight,
  RefreshCw,
  Search,
  ChevronRight,
  BarChart3,
  Clock,
  LayoutDashboard,
  CalendarDays,
  Receipt
} from "lucide-react";
import { Order, OrderItem } from "@/lib/site/types";
import { 
  format, 
  startOfToday, 
  startOfYesterday, 
  subDays, 
  startOfMonth, 
  subMonths, 
  isWithinInterval, 
  parseISO,
  isSameDay,
  startOfHour
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancialManagerProps {
  orders: Order[] | undefined;
  restaurantId: string;
  onRefresh: () => void;
  isLoading?: boolean;
}

type DateFilter = "today" | "yesterday" | "last7days" | "thisMonth" | "lastMonth" | "all";

export function FinancialManager({ orders = [], restaurantId, onRefresh, isLoading }: FinancialManagerProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("last7days");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Filters logic
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => !o.is_test_order && o.status !== 'cancelled');

    const now = new Date();
    const today = startOfToday();
    const yesterday = startOfYesterday();

    if (dateFilter === "today") {
      result = result.filter(o => isSameDay(parseISO(o.created_at), today));
    } else if (dateFilter === "yesterday") {
      result = result.filter(o => isSameDay(parseISO(o.created_at), yesterday));
    } else if (dateFilter === "last7days") {
      const sevenDaysAgo = subDays(today, 7);
      result = result.filter(o => parseISO(o.created_at) >= sevenDaysAgo);
    } else if (dateFilter === "thisMonth") {
      const monthStart = startOfMonth(today);
      result = result.filter(o => parseISO(o.created_at) >= monthStart);
    } else if (dateFilter === "lastMonth") {
      const lastMonthStart = startOfMonth(subMonths(today, 1));
      const lastMonthEnd = subDays(startOfMonth(today), 1);
      result = result.filter(o => {
        const date = parseISO(o.created_at);
        return date >= lastMonthStart && date <= lastMonthEnd;
      });
    }

    if (paymentFilter !== "all") {
      result = result.filter(o => o.payment_method.toLowerCase() === paymentFilter.toLowerCase());
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o => 
        o.customer_name.toLowerCase().includes(s) || 
        o.id.toLowerCase().includes(s)
      );
    }

    return result;
  }, [orders, dateFilter, paymentFilter, search]);

  // Metrics calculation
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((acc, o) => acc + Number(o.total_amount), 0);
    const totalOrders = filteredOrders.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDeliveryFees = filteredOrders.reduce((acc, o) => acc + Number(o.delivery_fee), 0);
    
    const paymentStats = filteredOrders.reduce((acc: any, o) => {
      const method = o.payment_method.toLowerCase();
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    // Products ranking
    const productStats = filteredOrders.reduce((acc: any, o) => {
      o.order_items?.forEach((item: OrderItem) => {
        acc[item.name] = (acc[item.name] || 0) + item.quantity;
      });
      return acc;
    }, {});

    const topProducts = Object.entries(productStats)
      .map(([name, qty]: [string, any]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Hourly distribution
    const hourlyStats = filteredOrders.reduce((acc: any, o) => {
      const hour = new Date(o.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    const peakHour = Object.entries(hourlyStats)
      .sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "--";

    return {
      totalRevenue,
      totalOrders,
      avgTicket,
      totalDeliveryFees,
      paymentStats,
      topProducts,
      peakHour: peakHour !== "--" ? `${peakHour}:00` : "--"
    };
  }, [filteredOrders]);

  // Chart data
  const revenueChartData = useMemo(() => {
    const dailyData: any = {};
    filteredOrders.forEach(o => {
      const day = format(parseISO(o.created_at), "dd/MM");
      dailyData[day] = (dailyData[day] || 0) + Number(o.total_amount);
    });

    return Object.entries(dailyData)
      .map(([name, value]) => ({ name, value }))
      .reverse();
  }, [filteredOrders]);

  const paymentChartData = useMemo(() => {
    return [
      { name: "PIX", value: metrics.paymentStats.pix || 0, color: "#00CFBA" },
      { name: "Dinheiro", value: metrics.paymentStats.money || metrics.paymentStats.dinheiro || 0, color: "#22C55E" },
      { name: "Cartão", value: metrics.paymentStats.card || metrics.paymentStats.cartao || 0, color: "#3B82F6" },
    ].filter(i => i.value > 0);
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}
        </div>
        <Skeleton className="h-[400px] rounded-2xl bg-white/5" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Gestão Financeira
          </h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium italic">
            Dados reais e consolidados do seu faturamento
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 transition-all font-bold gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar Dados
          </Button>
          <div className="h-8 w-[1px] bg-white/10 hidden md:block mx-2" />
          <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
            <SelectTrigger className="w-[180px] rounded-xl border-white/10 bg-white/5 font-bold uppercase text-[10px] tracking-widest">
              <CalendarDays className="h-3 w-3 mr-2 text-primary" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="bg-background border-white/10">
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last7days">Últimos 7 dias</SelectItem>
              <SelectItem value="thisMonth">Este Mês</SelectItem>
              <SelectItem value="lastMonth">Mês Anterior</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Faturamento Bruto" 
          value={metrics.totalRevenue} 
          isCurrency 
          icon={<DollarSign className="h-5 w-5" />}
          trend={12} // Mock trend for now
          color="primary"
        />
        <MetricCard 
          title="Total de Pedidos" 
          value={metrics.totalOrders} 
          icon={<ShoppingBag className="h-5 w-5" />}
          color="secondary"
        />
        <MetricCard 
          title="Ticket Médio" 
          value={metrics.avgTicket} 
          isCurrency 
          icon={<Receipt className="h-5 w-5" />}
          color="accent"
        />
        <MetricCard 
          title="Taxas de Entrega" 
          value={metrics.totalDeliveryFees} 
          isCurrency 
          icon={<LayoutDashboard className="h-5 w-5" />}
          color="emerald"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 card-premium border-white/5 bg-white/[0.02] shadow-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Faturamento por Período
            </CardTitle>
            <CardDescription className="text-xs">Evolução diária das vendas (bruto)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#EAB308', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: 'white', fontWeight: 'black', marginBottom: '4px' }}
                  />
                  <Bar dataKey="value" fill="#EAB308" radius={[4, 4, 0, 0]} barSize={32}>
                    {revenueChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fillOpacity={0.8 + (index * 0.05)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChartState />}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="card-premium border-white/5 bg-white/[0.02] shadow-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-secondary" />
              Formas de Pagamento
            </CardTitle>
            <CardDescription className="text-xs">Distribuição por volume de pedidos</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[300px]">
            {paymentChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="200">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full grid grid-cols-1 gap-2 mt-4">
                  {paymentChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-muted-foreground uppercase tracking-tighter">{item.name}</span>
                      </div>
                      <span className="font-black">{item.value} pedidos</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyChartState />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card className="card-premium border-white/5 bg-white/[0.02] shadow-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topProducts.length > 0 ? (
              <div className="space-y-3">
                {metrics.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 group hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary text-xs">
                        {i + 1}
                      </div>
                      <span className="font-bold text-sm">{p.name}</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/5 border-white/10 font-black text-[10px]">
                      {p.qty} VENDIDOS
                    </Badge>
                  </div>
                ))}
              </div>
            ) : <EmptyListState />}
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card className="card-premium border-white/5 bg-white/[0.02] shadow-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Horário de Pico
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-48">
            <div className="text-center">
              <div className="text-5xl font-black text-primary mb-2 tracking-tighter shadow-glow">
                {metrics.peakHour}
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Horário com maior volume de pedidos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table/List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Últimos Pedidos
          </h3>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input 
              placeholder="Buscar por cliente..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl border-white/10 bg-white/5 text-xs font-bold placeholder:font-medium"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          {filteredOrders.length > 0 ? (
            filteredOrders.slice(0, 10).map((order) => (
              <div key={order.id} className="card-premium p-4 flex items-center justify-between gap-4 group hover:border-primary/30 transition-all bg-white/[0.01]">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs ${
                    order.payment_method === 'pix' ? 'bg-emerald-500/10 text-emerald-500' : 
                    order.payment_method === 'money' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {order.payment_method.substring(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-sm truncate uppercase tracking-tight">{order.customer_name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-bold uppercase tracking-tighter">
                      <span>{format(parseISO(order.created_at), "dd/MM 'às' HH:mm")}</span>
                      <span>•</span>
                      <span className="text-primary">{order.status}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-sm text-primary">R$ {Number(order.total_amount).toFixed(2)}</div>
                  <div className="text-[9px] text-muted-foreground font-bold uppercase">ID: {order.id.split('-')[0]}</div>
                </div>
              </div>
            ))
          ) : <EmptyListState />}
          {filteredOrders.length > 10 && (
             <Button variant="ghost" className="w-full text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary gap-2">
               Ver todos os {filteredOrders.length} pedidos <ChevronRight className="h-4 w-4" />
             </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, isCurrency, icon, trend, color }: any) {
  const colors: any = {
    primary: "text-primary bg-primary/10 border-primary/20",
    secondary: "text-secondary bg-secondary/10 border-secondary/20",
    accent: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <Card className="card-premium border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all group shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${colors[color] || colors.primary} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black tracking-tighter mb-1">
          {isCurrency ? "R$ " : ""}{typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: isCurrency ? 2 : 0 }) : value}
        </div>
        {trend && (
          <p className={`text-[10px] font-bold flex items-center gap-1 ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}% em relação ao anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChartState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
      <BarChart3 className="h-10 w-10" />
      <span className="text-[10px] font-black uppercase tracking-widest">Sem dados no período</span>
    </div>
  );
}

function EmptyListState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-30 border border-dashed border-white/10 rounded-2xl">
      <ShoppingBag className="h-8 w-8" />
      <span className="text-[10px] font-black uppercase tracking-widest">Nenhum pedido encontrado</span>
    </div>
  );
}

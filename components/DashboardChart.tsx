
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ChartDataPoint {
  name: string;
  respostas: number;
  transferencias: number;
}

interface DashboardChartProps {
  data: ChartDataPoint[];
}

export const DashboardChart: React.FC<DashboardChartProps> = ({ data }) => {
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorRespostas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0098F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0098F6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorTransferencias" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0E0069" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0E0069" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.1} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F172A',
              borderColor: '#1E293B',
              borderRadius: '8px',
              color: '#EDEDED'
            }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area
            type="monotone"
            dataKey="respostas"
            name="Respostas do Agente"
            stroke="#0098F6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRespostas)"
          />
          <Area
            type="monotone"
            dataKey="transferencias"
            name="Transferências Humanas"
            stroke="#0E0069"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorTransferencias)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
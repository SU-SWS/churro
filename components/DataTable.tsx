import React from 'react';

interface DataItem {
  rank?: number;
  name: string;
  value: number;
  uuid: string;
}

interface DataTableProps {
  title: string;
  data: DataItem[];
  valueLabel: string;
  total: number;
}

const DataTable: React.FC<DataTableProps> = ({ title, data, valueLabel, total }) => {
  return (
    <div className="w-full p-4 rounded-lg mb-8" style={{ backgroundColor: 'var(--stanford-white)' }}>
      <h3 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--stanford-cardinal)', fontFamily: 'Source Sans Pro, Arial, sans-serif' }}>
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="stanford-table min-w-full">
          <thead>
            <tr>
              <th className="px-6 py-3 text-center text-sm border" style={{ backgroundColor: 'var(--stanford-cardinal)', color: 'var(--stanford-white)', width: '50px' }}>
                Rank
              </th>
              <th className="px-6 py-3 text-left text-sm border" style={{ backgroundColor: 'var(--stanford-cardinal)', color: 'var(--stanford-white)' }}>
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs border" style={{ backgroundColor: 'var(--stanford-cardinal)', color: 'var(--stanford-white)' }}>
                UUID
              </th>
              <th className="px-6 py-3 text-right text-xs border" style={{ backgroundColor: 'var(--stanford-cardinal)', color: 'var(--stanford-white)' }}>
                {valueLabel}
              </th>
              <th className="px-6 py-3 text-right text-xs border" style={{ backgroundColor: 'var(--stanford-cardinal)', color: 'var(--stanford-white)' }}>
                % of Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item.uuid || index} style={{ backgroundColor: index % 2 === 0 ? 'var(--stanford-white)' : '#F9F6F2' }}>
                <td className="px-6 py-4 text-sm text-center border" style={{ color: 'var(--stanford-black)' }}>
                  {item.rank}
                </td>
                <td className="px-6 py-4 text-sm border" style={{ color: 'var(--stanford-black)' }}>
                  {item.name}
                </td>
                <td className="px-6 py-4 text-sm border font-mono" style={{ color: 'var(--stanford-black)' }}>
                  {item.uuid}
                </td>
                <td className="px-6 py-4 text-sm text-right border" style={{ color: 'var(--stanford-black)' }}>
                  {item.value.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-right border" style={{ color: 'var(--stanford-black)' }}>
                  {total > 0 ? ((item.value / total) * 100).toFixed(1) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="px-6 py-3 text-left text-xs border" style={{ backgroundColor: 'var(--stanford-gray)', color: 'var(--stanford-white)' }}>
                Total
              </td>
              <td className="px-6 py-3 text-right text-xs border" style={{ backgroundColor: 'var(--stanford-gray)', color: 'var(--stanford-white)' }}>
                {total.toLocaleString()}
              </td>
              <td className="px-6 py-3 text-right text-xs border" style={{ backgroundColor: 'var(--stanford-gray)', color: 'var(--stanford-white)' }}>
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
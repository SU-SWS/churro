import React from 'react';

interface DataTableProps {
  title: string;
  data: Array<{
    name: string;
    value: number;
    uuid: string;
  }>;
  valueLabel: string;
}

const DataTable: React.FC<DataTableProps> = ({ title, data, valueLabel }) => {
  return (
    <div className="w-full bg-white p-4 rounded-lg shadow-md mb-8">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-400">
          <thead className="bg-gray-100">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-400"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-400"
              >
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-400">
            {data.map((item, index) => (
              <tr
                key={item.uuid || index}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900 border border-gray-400">
                  {item.name}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium border border-gray-400">
                  {item.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-400">
                Total
              </td>
              <td className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-400">
                {data.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
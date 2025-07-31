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
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-b border-gray-300">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider border-b border-gray-300">
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300">
            {data.map((item, index) => (
              <tr key={item.uuid || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-300">
                  {item.name}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium">
                  {item.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-t border-gray-300 border-r border-gray-300">
                Total
              </td>
              <td className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider border-t border-gray-300">
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
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import styles from "./DarkDataGrid.module.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const DEFAULT_COLUMN = {
	resizable: true,
	sortable: true,
	minWidth: 90,
	headerClass: styles.centerHeader,
} satisfies ColDef;

export default function DarkDataGrid<TData>(props: AgGridReactProps<TData>) {
	return (
		<div className={"ag-theme-quartz-dark " + styles.shell}>
			<AgGridReact<TData>
				theme="legacy"
				rowHeight={38}
				headerHeight={38}
				defaultColDef={DEFAULT_COLUMN}
				suppressMovableColumns
				{...props}
			/>
		</div>
	);
}

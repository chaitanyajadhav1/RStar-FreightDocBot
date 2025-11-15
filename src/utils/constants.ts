import { FileText, FileCheck, Package, Shield } from "lucide-react"

export const API_BASE = "/api"



export const PROCESSING_STEPS = [
  {
    id: 'commercial_invoice',
    label: 'Commercial Invoice',
    description: 'Upload and review commercial invoice',
    icon: FileText,
  },
  {
    id: 'scomet_declaration',
    label: 'Scomet Declaration',
    description: 'Upload and review Scomet declaration',
    icon: FileCheck,
  },
  {
    id: 'packing_list',
    label: 'Packing List',
    description: 'Upload and review packing list',
    icon: Package,
  },
  {
    id: 'fumigation_certificate',
    label: 'Fumigation Certificate',
    description: 'Upload and review fumigation certificate',
    icon: Shield,
  },
   {
    id: 'Annexure A (EXPORT VALUE DECLARATION)',
    label: 'Annexure A',
    description: 'Upload and review Annexure A',
    icon: FileCheck,
  },

   {
    id: 'Airlines - Airway Bill',
    label: ' Airlines - Airway Bill',
    description: 'Upload and review  Airlines - Airway Bill',
    icon: FileCheck,
  },

   {
    id: 'Process Completed',
    label: ' Process Completed',
    description: '',
    icon: FileCheck,
  },

]
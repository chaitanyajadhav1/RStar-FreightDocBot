// src/app/api/invoice/airway-bill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    const { error } = await supabase
      .from('airway_bills')
      .update({
        // Update fields
        document_type: data.documentType,
        airway_bill_no: data.airwayBillNo,
        invoice_no: data.invoiceNo,
        invoice_date: data.invoiceDate,
        shippers_name: data.shippersName,
        shippers_address: data.shippersAddress,
        consignees_name: data.consigneesName,
        consignees_address: data.consigneesAddress,
        issuing_carriers_name: data.issuingCarriersName,
        issuing_carriers_city: data.issuingCarriersCity,
        agents_iata_code: data.agentsIataCode,
        airport_of_departure: data.airportOfDeparture,
        airport_of_destination: data.airportOfDestination,
        accounting_information: data.accountingInformation,
        hs_code_no: data.hsCodeNo,
        no_of_pieces: data.noOfPieces,
        gross_weight: data.grossWeight,
        chargeable_weight: data.chargeableWeight,
        nature_of_goods: data.natureOfGoods,
        updated_at: new Date().toISOString()
      })
      .eq('airway_bill_id', data.airway_bill_id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
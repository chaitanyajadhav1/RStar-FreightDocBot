// // src/app/api/invoice/validate/final/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { 
//   getInvoiceById,
//   getPackingListById,
//   getFumigationCertificateById,
//   getSCOMETDeclarationById,
//   getExportDeclarationById,
//   verifyPackingListAgainstInvoice,
//   verifyFumigationCertificateAgainstInvoice,
//   verifySCOMETAgainstInvoice
// } from '@/lib/database';

// export async function POST(request: NextRequest) {
//   try {
//     const { 
//       invoiceId, 
//       packingListId, 
//       certificateId, 
//       scometId, 
//       declarationId, 
//       userId 
//     } = await request.json();

//     if (!invoiceId || !userId) {
//       return NextResponse.json(
//         { error: 'Missing required fields: invoiceId, userId' },
//         { status: 400 }
//       );
//     }

//     console.log('[VALIDATION] Starting final cross-verification:', {
//       invoiceId,
//       packingListId,
//       certificateId,
//       scometId,
//       declarationId,
//       userId
//     });

//     // Fetch commercial invoice (mandatory)
//     const commercialInvoice = await getInvoiceById(invoiceId);
//     if (!commercialInvoice) {
//       return NextResponse.json(
//         { error: 'Commercial invoice not found' },
//         { status: 404 }
//       );
//     }

//     // Verify ownership
//     if (commercialInvoice.user_id !== userId) {
//       return NextResponse.json(
//         { error: 'Unauthorized access to documents' },
//         { status: 403 }
//       );
//     }

//     // Initialize results object
//     const crossValidation = {
//       invoiceToPackingList: [],
//       invoiceToFumigation: [],
//       invoiceToSCOMET: [],
//       overallStatus: 'valid' as 'valid' | 'warning' | 'error'
//     };

//     const validationPromises = [];
//     const statuses = [];

//     // Validate Packing List if provided
//     if (packingListId) {
//       const packingList = await getPackingListById(packingListId);
//       if (packingList && packingList.user_id === userId) {
//         validationPromises.push(
//           verifyPackingListAgainstInvoice(packingList, commercialInvoice)
//             .then(result => {
//               crossValidation.invoiceToPackingList = Object.entries(result.comparisonData.checks).map(([field, status]) => ({
//                 field,
//                 expected: result.comparisonData.invoiceData[field] || 'N/A',
//                 actual: result.comparisonData.packingListData[field] || 'N/A',
//                 status: status ? 'match' : 'mismatch',
//                 document: 'Packing List'
//               }));
//               statuses.push(result.status);
//             })
//             .catch(error => {
//               console.error('[VALIDATION] Packing list validation error:', error);
//               statuses.push('error');
//             })
//         );
//       }
//     }

//     // Validate Fumigation Certificate if provided
//     if (certificateId) {
//       const fumigationCertificate = await getFumigationCertificateById(certificateId);
//       if (fumigationCertificate && fumigationCertificate.user_id === userId) {
//         validationPromises.push(
//           verifyFumigationCertificateAgainstInvoice(fumigationCertificate, commercialInvoice)
//             .then(result => {
//               crossValidation.invoiceToFumigation = Object.entries(result.comparisonData.checks).map(([field, status]) => ({
//                 field,
//                 expected: result.comparisonData.invoiceData[field] || 'N/A',
//                 actual: result.comparisonData.certificateData[field] || 'N/A',
//                 status: status ? 'match' : 'mismatch',
//                 document: 'Fumigation Certificate'
//               }));
//               statuses.push(result.status);
//             })
//             .catch(error => {
//               console.error('[VALIDATION] Fumigation certificate validation error:', error);
//               statuses.push('error');
//             })
//         );
//       }
//     }

//     // Validate SCOMET Declaration if provided
//     if (scometId) {
//       const scometDeclaration = await getSCOMETDeclarationById(scometId);
//       if (scometDeclaration && scometDeclaration.user_id === userId) {
//         validationPromises.push(
//           verifySCOMETAgainstInvoice(scometDeclaration, commercialInvoice)
//             .then(result => {
//               crossValidation.invoiceToSCOMET = Object.entries(result.comparisonData.checks).map(([field, status]) => ({
//                 field,
//                 expected: result.comparisonData.invoiceData[field] || 'N/A',
//                 actual: result.comparisonData.scometData[field] || 'N/A',
//                 status: status ? 'match' : 'mismatch',
//                 document: 'SCOMET Declaration'
//               }));
//               statuses.push(result.status);
//             })
//             .catch(error => {
//               console.error('[VALIDATION] SCOMET declaration validation error:', error);
//               statuses.push('error');
//             })
//         );
//       }
//     }

//     // Wait for all validations to complete
//     await Promise.all(validationPromises);

//     // Determine overall status
//     if (statuses.length === 0) {
//       crossValidation.overallStatus = 'valid'; // No documents to validate
//     } else if (statuses.every(status => status === 'verified')) {
//       crossValidation.overallStatus = 'valid';
//     } else if (statuses.some(status => status === 'failed')) {
//       crossValidation.overallStatus = 'error';
//     } else {
//       crossValidation.overallStatus = 'warning';
//     }

//     console.log('[VALIDATION] Final cross-verification completed:', {
//       overallStatus: crossValidation.overallStatus,
//       packingListChecks: crossValidation.invoiceToPackingList.length,
//       fumigationChecks: crossValidation.invoiceToFumigation.length,
//       scometChecks: crossValidation.invoiceToSCOMET.length
//     });

//     return NextResponse.json({
//       success: true,
//       message: 'Final cross-verification completed successfully',
//       crossValidation,
//       documentCount: {
//         invoice: true,
//         packingList: !!packingListId,
//         fumigationCertificate: !!certificateId,
//         scometDeclaration: !!scometId,
//         exportDeclaration: !!declarationId
//       },
//       timestamp: new Date().toISOString()
//     });

//   } catch (error: any) {
//     console.error('[VALIDATION] Final cross-verification error:', error);
//     return NextResponse.json(
//       { 
//         error: 'Final verification failed',
//         details: error.message 
//       },
//       { status: 500 }
//     );
//   }
// }
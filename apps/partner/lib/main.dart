import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cargox_ui/cargox_ui.dart';

// Only for local mock workflows. KYC, selfie and payout are NOT wired to production.
const overrideApi = String.fromEnvironment('CARGOX_DEMO_API');
String get apiBase => overrideApi.isNotEmpty ? overrideApi :
    (Platform.isAndroid ? 'http://10.0.2.2:4173' : 'http://127.0.0.1:4173');

Future<dynamic> demo(String path, [Map<String, Object?>? postBody]) async {
  final http = HttpClient();
  try {
    final request = postBody == null
        ? await http.getUrl(Uri.parse(apiBase + path))
        : await http.postUrl(Uri.parse(apiBase + path));
    if (postBody != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(postBody));
    }
    final reply = await request.close();
    final body = jsonDecode(await utf8.decoder.bind(reply).join());
    if (reply.statusCode >= 400) throw Exception(
        (body is Map ? body['message'] : null) ?? 'Demo request failed');
    return body;
  } finally { http.close(force: true); }
}

void main() => runApp(MaterialApp(title:'CargoX Partner — LOCAL DEMO',
  theme:cargoxTheme(),debugShowCheckedModeBanner:false,home:const PartnerHome()));

class PartnerHome extends StatefulWidget {
  const PartnerHome({super.key});
  @override State<PartnerHome> createState()=>_PartnerHomeState();
}
class _PartnerHomeState extends State<PartnerHome> {
  String partner='demo-auto-01',status='Local demo only. No live KYC or identity verification.';
  List<dynamic> offers=[];
  bool loading=false;
  final rideId=TextEditingController(), code=TextEditingController();
  @override void initState(){super.initState();refresh();}
  @override void dispose(){rideId.dispose();code.dispose();super.dispose();}
  Future<void> refresh() async {
    if(loading)return; setState(()=>loading=true);
    try{
      final next=await demo('/api/offers?partnerId='+Uri.encodeQueryComponent(partner));
      if(mounted)setState(()=>offers=next as List<dynamic>);
    }catch(e){if(mounted)setState(()=>status=e.toString());}
    finally{if(mounted)setState(()=>loading=false);}
  }
  Future<void> act(String action,[String? id]) async{
    final ride=id??rideId.text.trim();
    if(ride.isEmpty){setState(()=>status='Select an accepted ride ID first.');return;}
    try{
      final result=await demo('/api/rides/'+Uri.encodeComponent(ride)+'/'+action,
        <String,Object?>{'partnerId':partner,if(action=='start')'code':code.text.trim()});
      if(mounted){
        setState((){
          status='Demo ride '+result['id'].toString()+' is '+result['state'].toString();
          if(action=='accept')rideId.text=ride;
        });
      }
      await refresh();
    }catch(e){if(mounted)setState(()=>status=e.toString());}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('CargoX Partner')),
    body:ListView(padding:const EdgeInsets.all(18),children:[
      Container(
        padding:const EdgeInsets.all(24),
        decoration:BoxDecoration(borderRadius:BorderRadius.circular(25),
          gradient:const LinearGradient(colors:[Color(0xFFDBFAEC),CargoXColors.primary])),
        child:const Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text('A BETTER SHIFT STARTS HERE',style:TextStyle(
            fontSize:11,color:CargoXColors.deep,fontWeight:FontWeight.bold,letterSpacing:1.3)),
          SizedBox(height:12),
          Text('Drive your day.',style:TextStyle(
            fontSize:32,fontWeight:FontWeight.w900,color:Color(0xFF135B48))),
          SizedBox(height:6),
          Text('Eligible offers, trip code and status — local demo only.'),
        ]),
      ),
      const SizedBox(height:16),
      const Text('Demo Partner',style:TextStyle(fontSize:18,fontWeight:FontWeight.bold)),
      DropdownButton<String>(isExpanded:true,value:partner,items:const [
        DropdownMenuItem(value:'demo-auto-01',child:Text('Demo Auto/Car Driver')),
        DropdownMenuItem(value:'demo-pink-01',child:Text('Demo Pink Rider · Women Only')),
      ],onChanged:(v){if(v!=null){setState(()=>partner=v);refresh();}}),
      const Card(color:Color(0xFFFFECF5),
        child:ListTile(leading:Icon(Icons.female,color:CargoXColors.pink),
        title:Text('Pink Rider preferences'),
        subtitle:Text('The demo Pink partner accepts verified eligible women only. '
            'Live identity checks are not connected.'))),
      OutlinedButton.icon(onPressed:refresh,icon:const Icon(Icons.refresh),
        label:const Text('Refresh eligible offers')),
      const SizedBox(height:12),
      Text('Ride offers ('+offers.length.toString()+')',
          style:const TextStyle(fontSize:20,fontWeight:FontWeight.w800)),
      if(offers.isEmpty) const Padding(padding:EdgeInsets.symmetric(vertical:14),
          child:Text('No eligible offers. Create a demo ride in Customer screen.')),
      ...offers.map((dynamic item){
        final ride=item as Map<String,dynamic>;
        return Card(margin:const EdgeInsets.only(top:9),child:Padding(
          padding:const EdgeInsets.all(14),child:Column(
            crossAxisAlignment:CrossAxisAlignment.start,children:[
              Text(ride['service'].toString().toUpperCase(),
                  style:const TextStyle(fontSize:18,fontWeight:FontWeight.w800)),
              Text(ride['pickup'].toString()+' → '+ride['drop'].toString()),
              if(ride['pinkOnly']==true)const Text('Pink Rider ONLY',
                  style:TextStyle(color:CargoXColors.pink,fontWeight:FontWeight.bold)),
              FilledButton(onPressed:()=>act('accept',ride['id'].toString()),
                  child:const Text('Accept demo offer'))
          ]))));
      }),
      const SizedBox(height:18),
      const Text('Manage accepted ride',style:TextStyle(
        fontSize:20,fontWeight:FontWeight.w800)),
      TextField(controller:rideId,
          decoration:const InputDecoration(labelText:'Accepted demo ride ID')),
      const SizedBox(height:10),
      TextField(controller:code,keyboardType:TextInputType.number,
          maxLength:4,decoration:const InputDecoration(
          labelText:'4-digit code from customer demo')),
      Row(children:[
        Expanded(child:FilledButton(onPressed:()=>act('start'),
            child:const Text('Verify & Start'))),
        const SizedBox(width:9),
        Expanded(child:OutlinedButton(onPressed:()=>act('finish'),
            child:const Text('Complete'))),
      ]),
      const SizedBox(height:12),SelectableText(status),
    ]),
  );
}

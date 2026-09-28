import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cargox_ui/cargox_ui.dart';

// LOCAL DEVELOPMENT DEMO ONLY. No real authentication, mapping or payments.
const overrideApi = String.fromEnvironment('CARGOX_DEMO_API');
String get apiBase => overrideApi.isNotEmpty
    ? overrideApi
    : (Platform.isAndroid ? 'http://10.0.2.2:4173' : 'http://127.0.0.1:4173');

Future<Map<String, dynamic>> submitDemo(String path, Map<String, Object?> body) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse(apiBase + path));
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode(body));
    final response = await request.close();
    final raw = await utf8.decoder.bind(response).join();
    final result = jsonDecode(raw) as Map<String, dynamic>;
    if (response.statusCode >= 400) throw Exception(result['message'] ?? 'Demo API error');
    return result;
  } finally {
    client.close(force: true);
  }
}

void main() => runApp(MaterialApp(
  title: 'CargoX Customer · Local Demo',
  theme: cargoxTheme(),
  debugShowCheckedModeBanner: false,
  home: const CustomerHome(),
));

class CustomerHome extends StatefulWidget {
  const CustomerHome({super.key});
  @override State<CustomerHome> createState() => _CustomerHomeState();
}
class _CustomerHomeState extends State<CustomerHome> {
  String service = 'auto', status = 'Development demo • no live rides or payments';
  bool pinkOnly = false, verifiedWomen = false, submitting = false;
  final pickup = TextEditingController(text: 'Home');
  final drop = TextEditingController(text: 'Office');
  final km = TextEditingController(text: '8');
  @override void dispose() { pickup.dispose(); drop.dispose(); km.dispose(); super.dispose(); }
  Future<void> book() async {
    if (submitting) return;
    setState(() {submitting = true; status = 'Creating local demo ride…';});
    try {
      final ride = await submitDemo('/api/rides', {
        'cityId': 'sambhajinagar', 'service': service, 'mode': 'now',
        'pickup': pickup.text, 'drop': drop.text,
        'distanceKm': double.tryParse(km.text) ?? -1,
        'pinkOnly': pinkOnly, 'allPassengersWomenVerified': verifiedWomen,
      });
      if (!mounted) return;
      final fare = (ride['quote']['farePaise'] as num) / 100;
      setState(() => status = 'Demo ride requested: ' + ride['id'].toString() +
          '\nEstimated INR ' + fare.toStringAsFixed(2) + '; assignment pending.');
    } catch (error) {
      if (mounted) setState(() => status = 'Could not create demo ride: ' + error.toString());
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }
  @override Widget build(BuildContext context) {
    final items = <(String, String, IconData, bool)>[
      ('bike','Bike',Icons.two_wheeler,false),
      ('auto','Auto',Icons.electric_rickshaw,true),
      ('car','Car',Icons.local_taxi,true),
      ('outstation','Outstation',Icons.route,false),
      ('shared','Shared Car',Icons.groups_2,false),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('CargoX', style: TextStyle(fontWeight: FontWeight.w900))),
      body: ListView(padding: const EdgeInsets.all(18), children: [
        Container(
          padding: const EdgeInsets.all(25),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            gradient: const LinearGradient(colors: [Color(0xFFD9F9EE),CargoXColors.primary])),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('YOUR CITY. YOUR WAY.', style: TextStyle(color: CargoXColors.deep,
                fontWeight: FontWeight.w900, letterSpacing: 2, fontSize: 11)),
            SizedBox(height: 10),Text('Move beautifully.\nGo anywhere.',
                style: TextStyle(color: Color(0xFF0A6248),fontSize: 34,
                    fontWeight: FontWeight.w900,height: 1.1)),
            SizedBox(height: 10),
            Text('Chhatrapati Sambhajinagar · LOCAL DEMO', style: TextStyle(fontSize: 12)),
          ]),
        ),
        const SizedBox(height: 28),
        const Text('Where to next?', style: TextStyle(fontWeight: FontWeight.w800,fontSize: 25)),
        const SizedBox(height: 14),
        GridView.builder(
          shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, childAspectRatio: 1.03,
              crossAxisSpacing: 12,mainAxisSpacing: 12),
          itemBuilder: (context,index) {
            final item=items[index];
            return CargoXServiceCard(
              label: item.$2, subtitle: item.$4 ? 'Demo available' : 'Coming soon',
              icon: item.$3, enabled: item.$4, selected: service == item.$1,
              onTap: () => setState(() => service = item.$1),
            );
          },
        ),
        const SizedBox(height: 18),
        Card(color: const Color(0xFFFFEEF6), elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          child: const ListTile(
            leading: Icon(Icons.female,color: CargoXColors.pink,size: 38),
            title: Text('Pink Rider',style: TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text('Verified opted-in woman-driver preference. No silent substitution.'),
          )),
        const SizedBox(height: 22),
        FilledButton.icon(onPressed: ()=>Navigator.push(context,
            MaterialPageRoute(builder: (_) => const DailyPreview())),
          icon: const Icon(Icons.calendar_month),label: const Text('Daily Services & Monthly Packs')),
        const SizedBox(height: 20),
        const Text('Book Now',style: TextStyle(fontSize: 24,fontWeight: FontWeight.w800)),
        TextField(controller: pickup, decoration: const InputDecoration(labelText: 'Pickup')),
        const SizedBox(height: 11),
        TextField(controller: drop, decoration: const InputDecoration(labelText: 'Destination')),
        const SizedBox(height: 11),
        TextField(controller: km, keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Demo distance (km)')),
        SwitchListTile.adaptive(title: const Text('Demo: all passengers verified women'),
            value: verifiedWomen, onChanged: (v)=>setState(()=>verifiedWomen=v)),
        SwitchListTile.adaptive(title: const Text('Pink Rider Only'),
            subtitle: const Text('Never silently assign another driver'),
            value: pinkOnly,onChanged: (v)=>setState(()=>pinkOnly=v),
            activeColor: CargoXColors.pink),
        FilledButton(onPressed: submitting ? null : book,
            child: const Text('Request demo ride')),
        const SizedBox(height: 15),
        SelectableText(status,style: const TextStyle(color: CargoXColors.deep)),
        const SizedBox(height: 35),
      ]),
    );
  }
}

class DailyPreview extends StatefulWidget {
  const DailyPreview({super.key});
  @override State<DailyPreview> createState()=>_DailyPreviewState();
}
class _DailyPreviewState extends State<DailyPreview> {
  final pickup=TextEditingController(text:'Home');
  final drop=TextEditingController(text:'Office');
  final km=TextEditingController(text:'8');
  final days=<int>{1,2,3,4,5};
  bool returnTrip=true, loading=false;
  DateTime start=DateTime.now(), end=DateTime.now().add(const Duration(days:27));
  TimeOfDay pickupTime=const TimeOfDay(hour:8,minute:30),
    returnTime=const TimeOfDay(hour:18,minute:0);
  String status='Unpaid quote only; school service requires separate clearance.';
  @override void dispose(){pickup.dispose();drop.dispose();km.dispose();super.dispose();}
  String date(DateTime d)=>d.year.toString().padLeft(4,'0')+'-'+
    d.month.toString().padLeft(2,'0')+'-'+d.day.toString().padLeft(2,'0');
  String clock(TimeOfDay t)=>t.hour.toString().padLeft(2,'0')+':'+t.minute.toString().padLeft(2,'0');
  Future<void> preview() async {
    if(loading)return;
    setState(()=>loading=true);
    try{
      final plan=await submitDemo('/api/plans/quote',{
        'service':'auto','pickup':pickup.text,'drop':drop.text,
        'distanceKm':double.tryParse(km.text)??-1,
        'startDate':date(start),'endDate':date(end),
        'weekdays':days.toList()..sort(),'pickupTime':clock(pickupTime),
        'returnTime':returnTrip?clock(returnTime):null,
      });
      if(mounted)setState(()=>status=plan['legs'].length.toString()+' ride legs. '+
          'Unpaid illustrative total INR '+
          ((plan['totalPaise'] as num)/100).toStringAsFixed(2)+'.');
    }catch(error){if(mounted)setState(()=>status=error.toString());}
    finally{if(mounted)setState(()=>loading=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Daily & Monthly Pack')),
    body:ListView(padding:const EdgeInsets.all(18),children:[
      const Text('Fixed pickup & drop',style:TextStyle(fontSize:23,fontWeight:FontWeight.w800)),
      const SizedBox(height:15),
      TextField(controller:pickup,decoration:const InputDecoration(labelText:'Pickup')),
      TextField(controller:drop,decoration:const InputDecoration(labelText:'Drop')),
      TextField(controller:km,keyboardType:TextInputType.number,
          decoration:const InputDecoration(labelText:'Distance in demo kilometres')),
      const SizedBox(height:14),
      ListTile(title:Text('Starts: '+date(start)),trailing:const Icon(Icons.calendar_today),
        onTap:() async {final d=await showDatePicker(context:context,initialDate:start,
          firstDate:DateTime(2025),lastDate:DateTime(2035));
          if(d!=null)setState(()=>start=d);}),
      ListTile(title:Text('Ends: '+date(end)),trailing:const Icon(Icons.calendar_today),
        onTap:() async {final d=await showDatePicker(context:context,initialDate:end,
          firstDate:DateTime(2025),lastDate:DateTime(2035));
          if(d!=null)setState(()=>end=d);}),
      const Text('Choose weekdays'),
      Wrap(spacing:7,children:List.generate(7,(i)=>FilterChip(
        label:Text(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]),
        selected:days.contains(i+1),
        onSelected:(selected)=>setState((){if(selected){days.add(i+1);}else{days.remove(i+1);}}),
      ))),
      ListTile(title:Text('Pickup: '+clock(pickupTime)),
        onTap:()async{final t=await showTimePicker(context:context,initialTime:pickupTime);
          if(t!=null)setState(()=>pickupTime=t);}),
      SwitchListTile(title:const Text('Include separate return legs'),
          value:returnTrip,onChanged:(v)=>setState(()=>returnTrip=v)),
      if(returnTrip)ListTile(title:Text('Return: '+clock(returnTime)),
        onTap:()async{final t=await showTimePicker(context:context,initialTime:returnTime);
          if(t!=null)setState(()=>returnTime=t);}),
      FilledButton(onPressed:loading?null:preview,child:const Text('Preview unpaid pack')),
      const SizedBox(height:15),SelectableText(status),
    ]),
  );
}

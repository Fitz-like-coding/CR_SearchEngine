package fileCheck;    
import java.io.BufferedReader; 
import java.io.FileReader; 
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;
   
public class fileCheck { 

    @SuppressWarnings("unchecked")
	public static void main(String[] args) { 
    	HashMap<String, String> queries = new HashMap<String, String>();
    	HashMap<String, HashMap<String, ArrayList<String>>> intents = new HashMap<String, HashMap<String, ArrayList<String>>>();
    	HashMap<String, Float> intentsProbability = new HashMap<String, Float>();
    	HashMap<String, ArrayList<String>> subtopicsTen = new HashMap<String,ArrayList<String>>();
    	HashMap<String, Float> idealGGMap=new HashMap<String, Float>();
        try { 
           	BufferedReader readerQueries = new BufferedReader(new FileReader("G:/EvaluationPart/IMine2-E-Queries.tsv"));//换成你的文件名
           // reader.readLine();//第一行信息，为标题信息，不用，如果需要，注释掉
            String line = null; 
            while((line=readerQueries.readLine())!=null){ 
                String query[] = line.split("\t");//CSV格式文件为逗号分隔符文件，这里根据逗号切分
                queries.put(query[0], query[1]);
                //int value = Integer.parseInt(last);//如果是数值，可以转化为数值
            } 
            readerQueries.close();
        } catch (Exception e) { 
            e.printStackTrace(); 
        }  
        try { 
        	HashMap<String, ArrayList<String>> intentTopicsArray = new HashMap<String, ArrayList<String>>();
         	BufferedReader readerIntents = new BufferedReader(new FileReader("G:/EvaluationPart/IMine2-E-Intents.csv"));//换成你的文件名
         	//reader.readLine();//第一行信息，为标题信息，不用，如果需要，注释掉
	         String line = null; 
	         String currentID="";
	         float idealGG=0;
	         int idealRank=1;
	         while((line=readerIntents.readLine())!=null){            	 
	             String query[] = line.split(",");//CSV格式文件为逗号分隔符文件，这里根据逗号切分
	             intentsProbability.put(query[2], Float.parseFloat(query[1]));
	           	             
	             String tempID=query[0];
	             if(currentID.equals(""))	currentID=tempID;
            
	             if(!tempID.equals(currentID)){   
	            	 idealGGMap.put(currentID, idealGG);
	            	 idealGG=0;
	            	 idealRank=1;
	            	 intents.put(currentID, (HashMap<String, ArrayList<String>>) intentTopicsArray.clone());    
	            	 //System.out.println(currentID+"\t"+intentTopicsArray);
	            	 currentID=tempID;
	            	 intentTopicsArray.clear();
	             }

	             ArrayList<String> temp=new ArrayList<String>();
	             for(int i=3;i<query.length;i++){
	            	 temp.add(query[i]); 
	            	 if(idealRank<=10){
		            	 idealGG+=Float.parseFloat(query[1])/Math.log(idealRank+1);
		            	 idealRank++;
	        		 }
	             }
	             intentTopicsArray.put(query[2], temp); 
	             //System.out.println(tempID+"\t"+query[2]+"\t"+temp);
	             //int value = Integer.parseInt(last);//如果是数值，可以转化为数值
	         } 
	         idealGGMap.put(currentID, idealGG);
	         intents.put(currentID, (HashMap<String, ArrayList<String>>) intentTopicsArray.clone());  
	         readerIntents.close();
	         //System.out.println(idealGGMap.get("IMINE2-E-001"));
	         
         } catch (Exception e) { 
             e.printStackTrace(); 
         }
        
        try { 
           	BufferedReader readerSubtopics = new BufferedReader(new FileReader("G:/EvaluationPart/subtopics10.txt"));//换成你的文件名
           // reader.readLine();//第一行信息，为标题信息，不用，如果需要，注释掉
            String line = null; 
            String currentID="";
            ArrayList<String> tempSubtopic=new ArrayList<String>();
            while((line=readerSubtopics.readLine())!=null){ 
                String term[] = line.split("\t");//CSV格式文件为逗号分隔符文件，这里根据逗号切分
                String tempID=term[0];
                if(currentID.equals(""))	currentID=tempID;
                if(tempID.equals(currentID)){
                	tempSubtopic.add(term[1]);
                }
                else{
                	subtopicsTen.put(currentID, (ArrayList<String>) tempSubtopic.clone());
                	//System.out.println(currentID+" "+tempSubtopic);
                	currentID=tempID;
                	tempSubtopic.clear();
                	tempSubtopic.add(term[1]);
                }
                //int value = Integer.parseInt(last);//如果是数值，可以转化为数值
            } 
            subtopicsTen.put(currentID, (ArrayList<String>) tempSubtopic.clone());
            readerSubtopics.close();
        } catch (Exception e) { 
            e.printStackTrace(); 
        }  
        
//       for(int i=0;i<subtopicsTen.size();i++){
//        	System.out.println(queryID.get(i));
//       }
        HashMap<String, HashMap<String, Float>> queriesEvaluation = new HashMap<String, HashMap<String, Float>>();
        Iterator<Entry<String, ArrayList<String>>> allQueries = subtopicsTen.entrySet().iterator();
        while (allQueries.hasNext()) {
        	HashMap<String, Float> evaluationPart=new HashMap<String, Float>();
        	Entry<String, ArrayList<String>> currentQuery = allQueries.next();
        	String currentQueryID=currentQuery.getKey();
        	Iterator<String> currentQuerySubtopics=currentQuery.getValue().iterator();
        	//HashMap<String, Float> evaluationForSingleQuery=new HashMap<String, Float>();
        	float allGG=0;
        	int r=1;
        	float ourIntentsNumber=0;
        	float idealIntentsNumber=0;
        	if(intents.keySet().contains(currentQueryID)){
        		idealIntentsNumber=intents.get(currentQueryID).size();
	        	while (currentQuerySubtopics.hasNext()) {	        		
	        		String currentSubtopic=currentQuerySubtopics.next();
	        		String intentForSubtopic="null";       	
	        		Iterator<Entry<String, ArrayList<String>>> intentTopics=intents.get(currentQueryID).entrySet().iterator();
one:		        while(intentTopics.hasNext()){
	        			Entry<String, ArrayList<String>> intentEntry=intentTopics.next();
		       			String currentIntent=intentEntry.getKey();	
		       			ArrayList<String> currentIntentTopics=intentEntry.getValue();		       			
		       			for(String str:currentIntentTopics){	       				
	        				if(str.contains(currentSubtopic)){
	        					ourIntentsNumber++;
	        					intentForSubtopic=currentIntent;
	        					break one;
	        					//System.out.println(currentQueryID+"\t"+currentSubtopic+"\t"+intentForSubtopic);
	        				}
		       			}		       			
		        	}	        		
	        		float GGR=0;
	        		if(intentsProbability.get(intentForSubtopic)==null)	GGR=0;
	        		else	GGR=intentsProbability.get(intentForSubtopic);
	        		allGG+=GGR/Math.log(r+1);
	        		//System.out.println(currentQueryID+"\t"+currentSubtopic+"\t"+GGR/Math.log(r+1)+" "+r);
		        	//System.out.println(currentSubtopic);   		
	        		r++;
	        	}
        	}
        	//System.out.println(currentQueryID+"\t"+ourIntentsNumber);
        	//System.out.println(allGG);
        	if(idealGGMap.keySet().contains(currentQueryID)){
        		float DnDCG10=allGG/idealGGMap.get(currentQueryID);
        		float Irec=ourIntentsNumber/idealIntentsNumber;
        		float DnDCG=(float) (0.5*Irec+0.5*DnDCG10);
        		float accuracy=ourIntentsNumber; // even distribution (i.e. each vertical obtain P(v|i) = 1/4) 
        		float vscore=accuracy/10;
        		float QUscore=(float) (0.5*DnDCG+0.5*vscore);
        		evaluationPart.put("D-nDCG@10", DnDCG10);
        		evaluationPart.put("I-rec", Irec);
        		evaluationPart.put("D#-nDCG", DnDCG);
        		evaluationPart.put("Accuracy", accuracy);
        		evaluationPart.put("V-score@10", vscore);
        		evaluationPart.put("QU-score", QUscore);
        		queriesEvaluation.put(currentQueryID, evaluationPart);
        	}
        	//System.out.println(currentQueryID+"\t"+idealGG);
           // System.out.println(currentQueryID);
           // allQueries.remove(); // avoids a ConcurrentModificationException
        }	
        Iterator<Entry<String, HashMap<String, Float>>> abc=queriesEvaluation.entrySet().iterator();
        float aveQUscore=0;
        float aveDnDCG10=0;
        float aveIrec=0;
        float aveDnDCG=0;
        float aveAccuracy=0;
        float aveVscore=0;
        while (abc.hasNext()){
        	Entry<String, HashMap<String, Float>> output=abc.next();
        	aveQUscore+=output.getValue().get("QU-score");
        	aveDnDCG10+=output.getValue().get("D-nDCG@10");
        	aveIrec+=output.getValue().get("I-rec");
        	aveDnDCG+=output.getValue().get("D#-nDCG");
        	aveAccuracy+=output.getValue().get("Accuracy");
        	aveVscore+=output.getValue().get("V-score@10");
        	//System.out.println(output.getKey()+"\t"+output.getValue().get("QU-score"));
        }
        aveQUscore=aveQUscore/queriesEvaluation.size();
    	aveDnDCG10=aveDnDCG10/queriesEvaluation.size();
    	aveIrec=aveIrec/queriesEvaluation.size();
    	aveDnDCG=aveDnDCG/queriesEvaluation.size();
    	aveAccuracy=aveAccuracy/queriesEvaluation.size();
    	aveVscore=aveVscore/queriesEvaluation.size();
        System.out.println("aveQU-score:	"+aveQUscore);
        System.out.println("aveD-nDCG@10:	"+aveDnDCG10);
        System.out.println("aveI-rec:	"+aveIrec);
        System.out.println("aveD#-nDCG:	"+aveDnDCG);
        System.out.println("aveAccuracy:	"+aveAccuracy);
        System.out.println("aveV-score@10:	"+aveVscore);
    } 
}